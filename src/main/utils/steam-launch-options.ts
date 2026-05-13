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
import * as vdf from '@node-steam/vdf';
import dlv from 'dlv';
import { dset } from 'dset';
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
 * Merge user's existing Steam LaunchOptions with the translator-provided value.
 *
 * Steam's `%command%` token splits the launch string into two zones:
 *   <env / wrappers> %command% <game CLI args>
 *
 * Translator value typically contains `%command%` (Proton wrappers). The user's
 * existing value is usually plain game flags (`-skipintro`, etc.) and should
 * land in the args zone. If our value has `%command%`, splice their flags right
 * after it; otherwise just space-concatenate.
 *
 * Idempotent: if `existing` already contains our value as a substring, return
 * `existing` unchanged so re-runs don't keep appending duplicates.
 */
function mergeLaunchOptions(existing: string | null, ours: string): string {
  const existingTrim = (existing ?? '').trim();
  if (!existingTrim) return ours;
  if (existingTrim.includes(ours)) return existingTrim;

  if (ours.includes('%command%')) {
    return ours.replace('%command%', `%command% ${existingTrim}`);
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
  const value = pickOptionsForCurrentOS(params);
  if (!value || value.trim() === '') {
    return {
      written: false,
      steamRestarted: false,
      reason: 'No launch options for current OS',
    };
  }

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
