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
import { isCefDebuggingEnabledInSettings } from '@/main/utils/cef-flag-file';
import {
  mergeLaunchOptions,
  resolveGameDirToken,
  usesGameDirToken,
} from '@/main/utils/launch-options-value';
import { forCurrentOS } from '@/main/utils/platform';
import { evaluateInSharedJsContext, isCefAvailable } from '@/main/utils/steam-cef';
import { isSteamRunning } from '@/main/utils/steam-launcher';
import type { Game } from '@/shared/types';

interface WriteLaunchOptionsParams {
  appId: number;
  /** Value for Windows builds. */
  windowsOptions: string | null;
  /** Value for Linux Proton builds. */
  linuxOptions: string | null;
  /**
   * Value for macOS. Never falls back to the Linux one: the path inside the
   * game differs (`Contents/MacOS`), so the Linux value would point Steam at
   * something that isn't there — silently, since the game still launches.
   */
  macosOptions: string | null;
  /**
   * Where the game is installed, used to resolve `{GAME_DIR}`. Optional: values
   * without the token don't need it.
   */
  gamePath?: string | null;
}

type WriteLaunchOptionsMode =
  | 'noop' // nothing to write (no options for current OS, or already in place)
  | 'cef' // applied live through Steam's CEF API
  | 'file' // wrote localconfig.vdf directly (Steam was off)
  | 'needs-shutdown' // Steam running + CEF unreachable (e.g. Millennium) —
  //                    caller can prompt user to restart Steam then re-apply.
  | 'unresolved' // options needed a value we could not supply (unknown game
  //                 folder, or an unquoted token)
  | 'failed'; // tried to write and could not. Both are kept apart from 'noop'
//               so a write that never happened is never read as success.

interface WriteLaunchOptionsResult {
  mode: WriteLaunchOptionsMode;
  reason?: string;
}

function pickOptionsForCurrentOS(params: WriteLaunchOptionsParams): string | null {
  return forCurrentOS({
    windows: params.windowsOptions,
    macos: params.macosOptions,
    linux: params.linuxOptions,
  });
}

/** Fields of a translation record this module reads. */
type LaunchOptionsSource = Pick<
  Game,
  | 'steam_app_id'
  | 'steam_launch_options_windows'
  | 'steam_launch_options_linux'
  | 'steam_launch_options_macos'
>;

/**
 * Build the write params from a translation record. Callers used to assemble
 * these by hand in two places, so adding a field meant editing both — and a
 * missed site degrades to a silent noop rather than a compile error.
 *
 * Returns null when this translation configures no launch options at all.
 */
export function launchOptionsParamsFor(
  game: LaunchOptionsSource,
  gamePath: string | null
): WriteLaunchOptionsParams | null {
  if (
    !game.steam_app_id ||
    !(
      game.steam_launch_options_windows ||
      game.steam_launch_options_linux ||
      game.steam_launch_options_macos
    )
  ) {
    return null;
  }

  return {
    appId: game.steam_app_id,
    windowsOptions: game.steam_launch_options_windows,
    linuxOptions: game.steam_launch_options_linux,
    macosOptions: game.steam_launch_options_macos,
    gamePath,
  };
}

/**
 * True when the value this OS will actually use needs the game folder resolved.
 * Checks one column, not both: looking up the install path is expensive, and
 * the other platform's value is never written here.
 */
export function needsGameDir(game: LaunchOptionsSource): boolean {
  return usesGameDirToken(
    forCurrentOS({
      windows: game.steam_launch_options_windows,
      macos: game.steam_launch_options_macos,
      linux: game.steam_launch_options_linux,
    })
  );
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
    if (!next) {
      return null;
    }
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
  // Trimmed once, here: the idempotency checks downstream compare against a
  // trimmed existing value, so stray whitespace from the admin form would make
  // every re-install look like a new value and append a duplicate.
  const configured = pickOptionsForCurrentOS(params)?.trim();
  if (!configured) {
    return { mode: 'noop', reason: 'No launch options for current OS' };
  }

  const resolution = resolveGameDirToken(configured, params.gamePath ?? null);
  if (resolution.value === null) {
    return { mode: 'unresolved', reason: resolution.reason };
  }
  const value = resolution.value;

  const localConfigPath = getLocalConfigPath();
  if (!localConfigPath || !fs.existsSync(localConfigPath)) {
    return {
      mode: 'failed',
      reason: 'localconfig.vdf not found — Steam never started?',
    };
  }

  const appIdStr = String(params.appId);
  let plan: MergePlan;
  try {
    plan = readAndPlanMerge(localConfigPath, appIdStr, value);
  } catch (error) {
    return {
      mode: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  if (plan.merged === (plan.existing ?? '').trim()) {
    console.log(
      `[SteamLaunchOptions] App ${params.appId} already contains our LaunchOptions — nothing to do`
    );
    return { mode: 'noop', reason: 'LaunchOptions already include our value' };
  }

  // Steam off → file is safe to edit directly. Skip CEF entirely (Steam isn't
  // there to talk to anyway) and don't touch the flag file (no benefit).
  if (!(await isSteamRunning())) {
    try {
      writeMergedToLocalConfig(localConfigPath, plan, appIdStr);
      console.log(
        `[SteamLaunchOptions] App ${params.appId} wrote ${path.basename(localConfigPath)} (Steam off)`
      );
      return { mode: 'file' };
    } catch (error) {
      return {
        mode: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Steam on → only CEF is safe. The settings check matters mid-session: the
  // port stays open until Steam restarts even after the flag file is deleted.
  if (isCefDebuggingEnabledInSettings() && (await isCefAvailable())) {
    try {
      await evaluateInSharedJsContext(
        `SteamClient.Apps.SetAppLaunchOptions(${params.appId}, ${jsString(plan.merged)})`
      );
      console.log(`[SteamLaunchOptions] App ${params.appId} updated live via CEF`);
      return { mode: 'cef' };
    } catch (error) {
      return {
        mode: 'failed',
        reason: error instanceof Error ? error.message : 'CEF apply failed',
      };
    }
  }

  // Steam running but no usable CEF (setting off, Millennium, or first-run
  // restart pending). Editing localconfig.vdf now is unsafe (Steam overwrites
  // on exit) → surface `needs-shutdown` so the caller can prompt a restart.
  return {
    mode: 'needs-shutdown',
    reason: 'Steam running without CEF — restart required to apply',
  };
}
