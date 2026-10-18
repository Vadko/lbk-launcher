import { execFile, execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { promisify } from 'util';
import { getSteamExePath, getSteamPath } from '@/main/game-detector/steam';
import { millenniumLaunchEnv } from '@/main/millennium-install/launch-env';
import { steamTypeFromPath } from '@/main/plugin-host/support';
import {
  findSteamPids,
  isSteamElevated,
  isSteamRunning,
  waitForSteamGone,
  waitForSteamStart,
} from '@/main/steam-process/lifecycle';
import { getRunningSteamGameId } from '@/main/steam-process/running-game';
import { execFileOnHost, isFlatpak, spawnOnHost, system32 } from '@/main/utils/host-exec';
import { findMacMillenniumWrapper } from '@/main/utils/millennium';
import { forCurrentOS, isGamescopeSession } from '@/main/utils/platform';
import { errnoCode, errorMessage } from '@/shared/errors';
import type {
  RestartFailureReason,
  RestartSteamResult,
} from '@/shared/plugin-host-types';

const execFileAsync = promisify(execFile);

type SteamInstallationType = 'native' | 'flatpak' | 'snap' | 'unknown';

interface LaunchResult {
  success: boolean;
  error?: string;
}

function detectLinuxSteamType(): SteamInstallationType {
  const home = homedir();

  // When running in Flatpak, we need to check the host filesystem
  // The paths are still accessible via --filesystem permissions
  if (existsSync(`${home}/.var/app/com.valvesoftware.Steam`)) {
    return 'flatpak';
  }

  if (existsSync(`${home}/snap/steam`)) {
    return 'snap';
  }

  // Check if native steam command exists on host
  try {
    if (isFlatpak()) {
      execSync('flatpak-spawn --host which steam', { stdio: 'ignore' });
    } else {
      execSync('which steam', { stdio: 'ignore' });
    }
    return 'native';
  } catch {
    // If we're in Flatpak and can't find native steam, check if Flatpak Steam is installed
    if (isFlatpak()) {
      try {
        execSync('flatpak-spawn --host flatpak info com.valvesoftware.Steam', {
          stdio: 'ignore',
        });
        return 'flatpak';
      } catch {
        // Flatpak Steam not installed
      }
    }
    return 'unknown';
  }
}

// A leftover ~/.var/app/com.valvesoftware.Steam fools detectLinuxSteamType(); the found Steam path does not.
export function currentLinuxSteamType(
  steamPath: string | null = getSteamPath()
): SteamInstallationType {
  return steamPath ? steamTypeFromPath(steamPath, homedir()) : detectLinuxSteamType();
}

type ShutdownResult =
  | { ok: true }
  | { ok: false; reason: Exclude<RestartFailureReason, 'launch-failed'> };

const GRACEFUL_EXIT_TIMEOUT_MS = 30000;
const FORCED_EXIT_TIMEOUT_MS = 5000;
const EXEC_TIMEOUT_MS = 10000;
const MILLENNIUM_WRAPPER_START_TIMEOUT_MS = 15000;
const MILLENNIUM_ASSETS_ROOT_ENV = 'MILLENNIUM_ASSETS_ROOT';
const MILLENNIUM_WRAPPER_ASSETS = 'Contents/Resources/millennium-assets';

// How each Linux Steam flavour is started; only a host Steam takes the Millennium runtime env.
const LINUX_STEAM_COMMANDS: Record<
  SteamInstallationType,
  { command: string; args: string[]; millenniumEnv: boolean }
> = {
  flatpak: {
    command: 'flatpak',
    args: ['run', 'com.valvesoftware.Steam'],
    millenniumEnv: false,
  },
  snap: { command: 'snap', args: ['run', 'steam'], millenniumEnv: false },
  native: { command: 'steam', args: [], millenniumEnv: true },
  unknown: { command: 'steam', args: [], millenniumEnv: true },
};

interface SteamOsControl {
  requestExit: () => Promise<void>;
  // Resolves true when Windows refused to kill a Steam process that is still alive.
  forceKill: (steamPids: number[]) => Promise<boolean>;
  launch: (url?: string) => Promise<boolean>;
}

async function pkill(signal: 'TERM' | 'KILL', name: string): Promise<void> {
  const uid = process.getuid?.();
  const userArgs = uid === undefined ? [] : ['-u', String(uid)];
  try {
    await execFileOnHost('pkill', [`-${signal}`, '-x', ...userArgs, name]);
  } catch {
    // pkill exits 1 when nothing matched.
  }
}

async function terminate(main: string, helper: string): Promise<boolean> {
  await pkill('TERM', main);
  if (!(await waitForSteamGone(FORCED_EXIT_TIMEOUT_MS))) {
    await pkill('KILL', main);
    await pkill('KILL', helper);
  }
  return false;
}

async function openSteamUrl(url?: string): Promise<boolean> {
  const { shell } = await import('electron');
  try {
    await shell.openExternal(url || 'steam://');
    return true;
  } catch (error) {
    console.error('[Steam] Failed to launch Steam:', error);
    return false;
  }
}

function launchSteamLinux(url?: string): boolean {
  const steamType = currentLinuxSteamType();
  const args = url ? [url] : [];
  const steam = LINUX_STEAM_COMMANDS[steamType];

  console.log(
    `[Steam] Launching Steam (${steamType})${url ? ` with URL: ${url}` : ''}${isFlatpak() ? ' [from Flatpak]' : ''}`
  );

  try {
    try {
      spawnOnHost(
        steam.command,
        [...steam.args, ...args],
        steam.millenniumEnv ? millenniumLaunchEnv() : {}
      );
      return true;
    } catch (error) {
      // Without a known flavour xdg-open can still hand the URL to whatever Steam there is.
      if (steamType !== 'unknown' || !url) {
        throw error;
      }
      spawnOnHost('xdg-open', [url]);
      return true;
    }
  } catch (error) {
    console.error('[Steam] Failed to launch Steam:', error);
    return false;
  }
}

// false means Steam did not come up, so the caller falls back to steam:// (Steam without Millennium).
async function launchSteamViaMillenniumWrapper(
  app: string,
  url?: string
): Promise<boolean> {
  console.log(
    `[Steam] Launching Steam through ${app}${url ? ` then opening ${url}` : ''}`
  );
  // LaunchServices runs the wrapper's symlinked executable by its real path, where v3.5.0 looks for ../Resources and exits.
  const assetsRoot = `${MILLENNIUM_ASSETS_ROOT_ENV}=${path.join(app, MILLENNIUM_WRAPPER_ASSETS)}`;
  try {
    await execFileAsync('/usr/bin/open', ['-a', app, '--env', assetsRoot], {
      timeout: EXEC_TIMEOUT_MS,
    });
  } catch (error) {
    console.error(
      '[Steam] Failed to launch the Millennium wrapper:',
      errorMessage(error)
    );
    return false;
  }
  if (!(await waitForSteamStart(MILLENNIUM_WRAPPER_START_TIMEOUT_MS))) {
    console.warn('[Steam] Millennium wrapper exited without starting Steam');
    return false;
  }
  if (!url) {
    return true;
  }
  const { shell } = await import('electron');
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('[Steam] Failed to open Steam URL:', errorMessage(error));
    return false;
  }
}

const windowsControl: SteamOsControl = {
  requestExit: async () => {
    const steamExe = getSteamExePath();
    if (steamExe) {
      await execFileAsync(steamExe, ['-shutdown'], {
        timeout: EXEC_TIMEOUT_MS,
        windowsHide: true,
      });
    } else {
      const { shell } = await import('electron');
      await shell.openExternal('steam://exit');
    }
  },
  forceKill: async (steamPids) => {
    let denied = false;
    for (const pid of steamPids) {
      try {
        await execFileAsync(system32('taskkill.exe'), ['/F', '/PID', String(pid)], {
          timeout: EXEC_TIMEOUT_MS,
          windowsHide: true,
        });
      } catch (error) {
        // Exit code 1 is "access denied" or "not found"; the localized text is never parsed.
        if (errnoCode(error) === 1) {
          denied = true;
        }
      }
    }
    await execFileAsync(system32('taskkill.exe'), ['/F', '/IM', 'steamwebhelper.exe'], {
      timeout: EXEC_TIMEOUT_MS,
      windowsHide: true,
    }).catch(() => void 0);
    return denied && isSteamRunning();
  },
  launch: openSteamUrl,
};

const linuxControl: SteamOsControl = {
  requestExit: async () => {
    const steam = LINUX_STEAM_COMMANDS[currentLinuxSteamType()];
    await execFileOnHost(steam.command, [...steam.args, '-shutdown']);
  },
  forceKill: async () => {
    if (currentLinuxSteamType() === 'flatpak') {
      await execFileOnHost('flatpak', ['kill', 'com.valvesoftware.Steam']).catch(
        () => void 0
      );
    }
    return terminate('steam', 'steamwebhelper');
  },
  launch: (url) => Promise.resolve(launchSteamLinux(url)),
};

const macControl: SteamOsControl = {
  // No Automation (TCC) prompt, unlike osascript; Steam ignores steam://ExitSteam.
  requestExit: async () => {
    await execFileAsync('/usr/bin/open', ['-g', 'steam://exit'], {
      timeout: EXEC_TIMEOUT_MS,
    });
  },
  forceKill: () => terminate('steam_osx', 'Steam Helper'),
  launch: async (url) => {
    const wrapper = findMacMillenniumWrapper();
    if (
      wrapper &&
      !(await isSteamRunning()) &&
      (await launchSteamViaMillenniumWrapper(wrapper, url))
    ) {
      return true;
    }
    return openSteamUrl(url);
  },
};

function osControl(): SteamOsControl {
  return forCurrentOS<SteamOsControl>({
    windows: windowsControl,
    linux: linuxControl,
    macos: macControl,
    other: {
      requestExit: () => Promise.resolve(),
      forceKill: () => Promise.resolve(false),
      launch: openSteamUrl,
    },
  });
}

async function requestGracefulExit(): Promise<void> {
  try {
    await osControl().requestExit();
  } catch (error) {
    console.warn('[Steam] Graceful shutdown request failed:', errorMessage(error));
  }
}

async function shutdownSteam(): Promise<ShutdownResult> {
  // Must come first: `steam -shutdown` and steam://exit start Steam when it is not up.
  const steamPids = await findSteamPids({ fresh: true });
  if (steamPids.length === 0) {
    console.log('[Steam] Steam is not running, skipping shutdown');
    return { ok: true };
  }

  if (isGamescopeSession()) {
    console.warn('[Steam] Refusing to shut down Steam inside a gamescope session');
    return { ok: false, reason: 'gamescope' };
  }

  if (await isSteamElevated()) {
    console.warn('[Steam] Steam runs elevated, cannot shut it down');
    return { ok: false, reason: 'access-denied' };
  }

  const runningGame = await getRunningSteamGameId();
  if (runningGame !== null) {
    console.warn(`[Steam] Game ${runningGame} is running, not shutting Steam down`);
    return { ok: false, reason: 'game-running' };
  }

  console.log('[Steam] Shutting down Steam...');
  await requestGracefulExit();

  if (await waitForSteamGone(GRACEFUL_EXIT_TIMEOUT_MS)) {
    console.log('[Steam] Steam shutdown complete');
    return { ok: true };
  }

  if ((await getRunningSteamGameId()) !== null) {
    console.warn('[Steam] A game started during shutdown, not force killing Steam');
    return { ok: false, reason: 'game-running' };
  }
  console.warn('[Steam] Steam did not exit gracefully, force killing...');
  if (await osControl().forceKill(await findSteamPids({ fresh: true }))) {
    console.warn('[Steam] Access denied while force killing Steam');
    return { ok: false, reason: 'access-denied' };
  }

  if (await waitForSteamGone(FORCED_EXIT_TIMEOUT_MS)) {
    console.log('[Steam] Steam shutdown complete (forced)');
    return { ok: true };
  }

  console.warn('[Steam] Steam is still running after a forced shutdown');
  return { ok: false, reason: 'timeout' };
}

export async function launchSteamGame(appId: string | number): Promise<LaunchResult> {
  const url = `steam://rungameid/${appId}`;
  console.log(`[Steam] Launching game with App ID: ${appId}`);

  const success = await osControl().launch(url);
  return {
    success,
    error: success ? undefined : 'Failed to launch Steam game',
  };
}

export async function restartSteamProcess(
  opts: { beforeLaunch?: () => Promise<void> | void } = {}
): Promise<RestartSteamResult> {
  console.log('[Steam] Restarting Steam...');

  try {
    const shutdown = await shutdownSteam();
    if (!shutdown.ok) {
      return { success: false, reason: shutdown.reason };
    }

    if (opts.beforeLaunch) {
      try {
        await opts.beforeLaunch();
      } catch (error) {
        console.warn(
          '[Steam] Work between shutdown and launch failed:',
          errorMessage(error)
        );
      }
    }

    if (await osControl().launch()) {
      console.log('[Steam] Steam restart initiated');
      return { success: true };
    }
    return { success: false, reason: 'launch-failed', error: 'Failed to launch Steam' };
  } catch (error) {
    console.error('[Steam] Failed to restart Steam:', error);
    return { success: false, reason: 'launch-failed', error: errorMessage(error) };
  }
}
