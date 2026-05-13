/**
 * Set per-app Steam LaunchOptions for the current user.
 *
 * Two paths, picked from Steam's current state — no queue, no defer:
 *
 *   - **Steam off** → write `localconfig.vdf` directly. Steam reads our value
 *     when it next starts. Editing the file while Steam runs is unsafe (Steam
 *     keeps an in-memory copy and rewrites the file on graceful exit) so this
 *     path is gated on Steam being down.
 *
 *   - **Steam on** → call `SteamClient.Apps.SetAppLaunchOptions(...)` over the
 *     CEF debug channel. Live update, no restart, works while Steam is open.
 *     This needs Steam's `.cef-enable-remote-debugging` flag file to exist
 *     and Steam to have been restarted at least once since the file appeared.
 *
 * If Steam is on but CEF isn't reachable yet (typically the first ever install
 * after we just touched the flag file), we surface a mandatory "restart Steam"
 * prompt. The user restarts Steam and re-runs the install — the second run
 * hits the CEF path. Install is idempotent so re-running is cheap.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { KeyV, KeyVRoot, KeyVSet, parse as vdfParse } from 'fast-vdf';
import { getLocalConfigPath } from '@/main/game-detector/steam';
import { ensureCefFlagFile } from '@/main/utils/cef-flag-file';
import { isLinux, isMacOS, isWindows } from '@/main/utils/platform';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';
import { isSteamRunning } from '@/main/utils/steam-launcher';

interface WriteLaunchOptionsParams {
  appId: number;
  /** Value for Windows builds. */
  windowsOptions: string | null;
  /**
   * Value for Linux Proton builds. The same string is also written on macOS
   * (Steam macOS uses the same %command% wrapper format as Linux Proton).
   */
  linuxOptions: string | null;
}

type WriteLaunchOptionsMode =
  | 'noop' // nothing to write (no options for current OS, or already in place)
  | 'cef' // applied live through Steam's CEF API
  | 'file' // wrote localconfig.vdf directly (Steam was off)
  | 'needs-restart'; // Steam on, CEF unreachable — caller prompts a restart

interface WriteLaunchOptionsResult {
  mode: WriteLaunchOptionsMode;
  /** true if user must restart Steam for the change to take effect. */
  needsSteamRestart: boolean;
  reason?: string;
}

function pickOptionsForCurrentOS(params: WriteLaunchOptionsParams): string | null {
  if (isWindows()) return params.windowsOptions;
  if (isLinux() || isMacOS()) return params.linuxOptions;
  return null;
}

const COMMAND_TOKEN = '%command%';

/**
 * Merge user's existing Steam LaunchOptions with the translator-provided value.
 *
 * Steam's `%command%` token splits the launch string into two zones:
 *   <env / wrappers> %command% <game CLI args>
 *
 * Translator values typically include `%command%` (Proton wrappers, env vars).
 * The user's existing value can be:
 *   - empty                 → just use ours
 *   - plain CLI flags       → splice them into our args zone after %command%
 *   - their own wrapper +
 *     %command% + args      → preserve only their args; replace their wrapper
 *                              (env/Proton setup is the translator's domain
 *                              and two wrappers can't co-exist)
 *
 * Idempotent: if our value (or the resulting merge) is already present,
 * returns existing unchanged so re-runs don't accumulate duplicates.
 */
function mergeLaunchOptions(existing: string | null, ours: string): string {
  const existingTrim = (existing ?? '').trim();
  if (!existingTrim) return ours;
  if (existingTrim === ours) return existingTrim;
  if (existingTrim.includes(ours)) return existingTrim;

  if (ours.includes(COMMAND_TOKEN)) {
    // Extract whatever args the user had after their own %command% (if any),
    // otherwise treat the whole existing string as plain args.
    const userArgs = existingTrim.includes(COMMAND_TOKEN)
      ? existingTrim
          .slice(existingTrim.indexOf(COMMAND_TOKEN) + COMMAND_TOKEN.length)
          .trim()
      : existingTrim;

    if (!userArgs) return ours;
    if (ours.includes(userArgs)) return ours;
    return ours.replace(COMMAND_TOKEN, `${COMMAND_TOKEN} ${userArgs}`);
  }

  return `${existingTrim} ${ours}`;
}

const LAUNCH_OPTIONS_PARENT = [
  'UserLocalConfigStore',
  'Software',
  'Valve',
  'Steam',
  'apps',
];

/** Read a string pair value walking a path of nested sets; returns null on any miss. */
function readNestedPairValue(
  root: KeyVRoot,
  segments: string[],
  pairKey: string
): string | null {
  let cursor: KeyVSet | KeyVRoot = root;
  for (const seg of segments) {
    const next: KeyVSet | null = cursor.dir(seg, null);
    if (!next) return null;
    cursor = next;
  }
  const pair: KeyV | null = cursor.pair(pairKey, null);
  return pair ? String(pair.value) : null;
}

/** Walk down `segments`, creating empty `KeyVSet` nodes for any missing rungs. */
function ensurePath(root: KeyVRoot, segments: string[]): KeyVSet {
  let cursor: KeyVSet | KeyVRoot = root;
  for (const seg of segments) {
    const existing: KeyVSet | null = cursor.dir(seg, null);
    if (existing) {
      cursor = existing;
    } else {
      const fresh = new KeyVSet(seg);
      cursor.add(fresh);
      cursor = fresh;
    }
  }
  return cursor as KeyVSet;
}

interface MergePlan {
  root: KeyVRoot;
  existing: string | null;
  merged: string;
}

/** Parse the localconfig file once and compute the merged LaunchOptions value. */
function readAndPlanMerge(
  localConfigPath: string,
  appId: string,
  value: string
): MergePlan {
  const raw = fs.readFileSync(localConfigPath, 'utf8');
  const root = vdfParse(raw);
  const existing = readNestedPairValue(
    root,
    [...LAUNCH_OPTIONS_PARENT, appId],
    'LaunchOptions'
  );
  const merged = mergeLaunchOptions(existing, value);
  return { root, existing, merged };
}

/** Splice merged value into the parsed tree and write back atomically. */
function writeMergedToLocalConfig(
  localConfigPath: string,
  plan: MergePlan,
  appIdStr: string
): void {
  const app = ensurePath(plan.root, [...LAUNCH_OPTIONS_PARENT, appIdStr]);
  const existingPair: KeyV | null = app.pair('LaunchOptions', null);
  if (existingPair) {
    existingPair.value = plan.merged;
  } else {
    app.add(new KeyV('LaunchOptions', plan.merged));
  }

  // Atomic write: serialize to a sibling tmp file then rename. `writeFileSync`
  // on its own truncates the target before writing, so a crash mid-write would
  // leave Steam's localconfig.vdf empty/broken — losing the user's entire Steam
  // config on next launch. `rename` is atomic on POSIX and on NTFS within a
  // volume, so either the new file or the old file is observable, never a
  // half-written one.
  const serialized = plan.root.dump();
  const tmp = `${localConfigPath}.lbk.tmp`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, localConfigPath);
}

/** CDP-quote helper for embedding our value into an evaluated JS expression. */
function jsString(s: string): string {
  return JSON.stringify(s);
}

/**
 * Apply the requested LaunchOptions value for `params.appId`, choosing CEF or
 * file based on Steam's current state. See module docstring for details.
 */
export async function writeSteamLaunchOptions(
  params: WriteLaunchOptionsParams
): Promise<WriteLaunchOptionsResult> {
  const value = pickOptionsForCurrentOS(params);
  if (!value || value.trim() === '') {
    return {
      mode: 'noop',
      needsSteamRestart: false,
      reason: 'No launch options for current OS',
    };
  }

  const localConfigPath = getLocalConfigPath();
  if (!localConfigPath || !fs.existsSync(localConfigPath)) {
    return {
      mode: 'noop',
      needsSteamRestart: false,
      reason: 'localconfig.vdf not found — Steam never started?',
    };
  }

  const appIdStr = String(params.appId);
  let plan: MergePlan;
  try {
    plan = readAndPlanMerge(localConfigPath, appIdStr, value);
  } catch (error) {
    return {
      mode: 'noop',
      needsSteamRestart: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  if (plan.merged === (plan.existing ?? '').trim()) {
    console.log(
      `[SteamLaunchOptions] App ${params.appId} already contains our LaunchOptions — nothing to do`
    );
    return {
      mode: 'noop',
      needsSteamRestart: false,
      reason: 'LaunchOptions already include our value',
    };
  }

  // Steam off → file is safe to edit directly. Skip CEF entirely (Steam isn't
  // there to talk to anyway) and don't touch the flag file (no benefit).
  if (!(await isSteamRunning())) {
    try {
      writeMergedToLocalConfig(localConfigPath, plan, appIdStr);
      console.log(
        `[SteamLaunchOptions] App ${params.appId} wrote ${path.basename(localConfigPath)} (Steam off)`
      );
      return { mode: 'file', needsSteamRestart: false };
    } catch (error) {
      return {
        mode: 'noop',
        needsSteamRestart: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Steam on → only CEF is safe. Make sure the flag file exists so the next
  // Steam restart opens the debug port for us.
  ensureCefFlagFile();

  if (await isCefAvailable()) {
    try {
      await evaluateInSharedJsContext(
        `SteamClient.Apps.SetAppLaunchOptions(${params.appId}, ${jsString(plan.merged)})`
      );
      console.log(`[SteamLaunchOptions] App ${params.appId} updated live via CEF`);
      return { mode: 'cef', needsSteamRestart: false };
    } catch (error) {
      console.warn(
        '[SteamLaunchOptions] CEF apply failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  // Steam on, CEF unreachable — caller will prompt the user to restart Steam.
  // No queue: after restart they re-run the install (idempotent) and the CEF
  // path will succeed.
  return {
    mode: 'needs-restart',
    needsSteamRestart: true,
    reason: 'Steam running without CEF; restart needed to enable live updates',
  };
}
