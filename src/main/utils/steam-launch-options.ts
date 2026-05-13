/**
 * Write Steam per-app LaunchOptions into userdata/<id>/config/localconfig.vdf.
 *
 * Steam keeps an in-memory copy of localconfig.vdf and rewrites the file on
 * graceful exit, so any edit made while Steam is running gets clobbered.
 * Correct order is: shut Steam down → edit the file → launch Steam again
 * (it picks the new value up on startup).
 *
 * VDF path: UserLocalConfigStore.Software.Valve.Steam.apps.<appId>.LaunchOptions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import dlv from 'dlv';
import { dset } from 'dset';
import * as vdf from 'simple-vdf';
import { getLocalConfigPath } from '@/main/game-detector/steam';
import { isLinux, isMacOS, isWindows } from '@/main/utils/platform';
import { isSteamRunning, launchSteam, shutdownSteam } from '@/main/utils/steam-launcher';

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

interface WriteLaunchOptionsResult {
  /** false = nothing to write (no options for current OS) or Steam path missing. */
  written: boolean;
  /** true = Steam was running and we restarted it so the new value takes effect. */
  steamRestarted: boolean;
  reason?: string;
}

function pickOptionsForCurrentOS(params: WriteLaunchOptionsParams): string | null {
  if (isWindows()) return params.windowsOptions;
  if (isLinux() || isMacOS()) return params.linuxOptions;
  return null;
}

/**
 * Convert a raw string to VDF on-disk escaped form.
 *
 * `simple-vdf` keeps escape sequences as literals on both parse and stringify
 * — so a value read from disk like `WINEDLLOVERRIDES=\"foo\"` comes back with
 * the literal backslash-quote characters, and any string we hand to stringify
 * goes to disk byte-for-byte. New values coming from our DB are in raw form
 * (plain `"`), so we have to escape them ourselves before writing, otherwise
 * Steam's parser breaks at the first unescaped quote.
 *
 * Backslash escaping must come first to avoid double-escaping the backslashes
 * we just inserted.
 */
function escapeVdfValue(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

/**
 * Write LaunchOptions for a specific app into the current Steam user's
 * localconfig.vdf. If Steam is running, shut it down first (otherwise it would
 * overwrite our edit when it exits), then launch it again so the value is
 * loaded fresh.
 */
export async function writeSteamLaunchOptions(
  params: WriteLaunchOptionsParams
): Promise<WriteLaunchOptionsResult> {
  const rawValue = pickOptionsForCurrentOS(params);
  if (!rawValue || rawValue.trim() === '') {
    return {
      written: false,
      steamRestarted: false,
      reason: 'No launch options for current OS',
    };
  }
  // Escape once here; from this point on we operate in disk-escaped form so
  // the merge and idempotency comparison line up with what dlv reads back.
  const value = escapeVdfValue(rawValue);

  const localConfigPath = getLocalConfigPath();
  if (!localConfigPath) {
    return {
      written: false,
      steamRestarted: false,
      reason: 'Steam user config path not found',
    };
  }
  if (!fs.existsSync(localConfigPath)) {
    return {
      written: false,
      steamRestarted: false,
      reason: `localconfig.vdf not found at ${localConfigPath}`,
    };
  }

  const launchOptionsPath = [
    'UserLocalConfigStore',
    'Software',
    'Valve',
    'Steam',
    'apps',
    String(params.appId),
    'LaunchOptions',
  ];

  /**
   * Read+parse localconfig.vdf and compute the merged LaunchOptions value.
   * Safe to call with Steam running — we only read here.
   */
  const readAndPlanMerge = (): {
    parsed: Record<string, unknown>;
    existing: string | null;
    merged: string;
  } => {
    const raw = fs.readFileSync(localConfigPath, 'utf8');
    const parsed = vdf.parse(raw) as Record<string, unknown>;
    const existingRaw: unknown = dlv(parsed, launchOptionsPath);
    const existing = typeof existingRaw === 'string' ? existingRaw : null;
    const merged = mergeLaunchOptions(existing, value);
    return { parsed, existing, merged };
  };

  // First pass: read with Steam possibly running. If our value is already
  // included, we can skip the whole shutdown/launch dance.
  let plan: ReturnType<typeof readAndPlanMerge>;
  try {
    plan = readAndPlanMerge();
  } catch (error) {
    return {
      written: false,
      steamRestarted: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  if (plan.merged === (plan.existing ?? '').trim()) {
    console.log(
      `[SteamLaunchOptions] App ${params.appId} already contains our LaunchOptions — nothing to do`
    );
    return {
      written: false,
      steamRestarted: false,
      reason: 'LaunchOptions already include our value',
    };
  }

  const steamWasRunning = await isSteamRunning();
  if (steamWasRunning) {
    console.log(
      '[SteamLaunchOptions] Shutting down Steam so it does not clobber our edit'
    );
    await shutdownSteam();
  }

  try {
    // Re-read after shutdown: Steam flushes its in-memory state to disk on
    // graceful exit, so the value we saw before shutdown may now be stale.
    if (steamWasRunning) {
      plan = readAndPlanMerge();
      if (plan.merged === (plan.existing ?? '').trim()) {
        console.log(
          `[SteamLaunchOptions] After Steam shutdown, app ${params.appId} already contains our LaunchOptions`
        );
        await launchSteam();
        return {
          written: false,
          steamRestarted: true,
          reason: 'LaunchOptions already include our value (post-shutdown)',
        };
      }
    }

    dset(plan.parsed, launchOptionsPath, plan.merged);

    const serialized = vdf.stringify(plan.parsed);
    const tmp = localConfigPath + '.lbk.tmp';
    fs.writeFileSync(tmp, serialized, 'utf8');
    fs.renameSync(tmp, localConfigPath);

    console.log(
      `[SteamLaunchOptions] Wrote LaunchOptions for app ${params.appId} to ${path.basename(localConfigPath)}`
    );

    if (steamWasRunning) {
      await launchSteam();
    }

    return { written: true, steamRestarted: steamWasRunning };
  } catch (error) {
    if (steamWasRunning) {
      // Even if write failed, restart Steam so user isn't left with Steam off
      await launchSteam().catch(() => void 0);
    }
    return {
      written: false,
      steamRestarted: steamWasRunning,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
