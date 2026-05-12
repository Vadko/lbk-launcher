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
import { dset } from 'dset';
import { getLocalConfigPath } from '@/main/game-detector/steam';
import { isLinux, isMacOS, isWindows } from '@/main/utils/platform';
import { isSteamRunning, launchSteam, shutdownSteam } from '@/main/utils/steam-launcher';

export interface WriteLaunchOptionsParams {
  appId: number;
  /** Value for Windows builds. */
  windowsOptions: string | null;
  /**
   * Value for Linux Proton builds. The same string is also written on macOS
   * (Steam macOS uses the same %command% wrapper format as Linux Proton).
   */
  linuxOptions: string | null;
}

export interface WriteLaunchOptionsResult {
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

  const steamWasRunning = await isSteamRunning();
  if (steamWasRunning) {
    console.log(
      '[SteamLaunchOptions] Shutting down Steam so it does not clobber our edit'
    );
    await shutdownSteam();
  }

  try {
    const raw = fs.readFileSync(localConfigPath, 'utf8');
    const parsed = vdf.parse(raw) as Record<string, unknown>;

    dset(
      parsed,
      [
        'UserLocalConfigStore',
        'Software',
        'Valve',
        'Steam',
        'apps',
        String(params.appId),
        'LaunchOptions',
      ],
      value
    );

    const serialized = vdf.stringify(parsed);
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
