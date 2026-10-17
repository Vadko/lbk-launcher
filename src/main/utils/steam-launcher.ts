/**
 * Steam Launcher Utilities
 * Unified logic for launching and restarting Steam across platforms
 */

import { type ChildProcess, execFile, execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { promisify } from 'util';
import { getSteamExePath } from '@/main/game-detector/steam';
import { millenniumLaunchEnv } from '@/main/millennium-install/launch-env';
import { findMacMillenniumWrapper } from '@/main/utils/millennium';
import { isGamescopeSession, isLinux, isMacOS, isWindows } from '@/main/utils/platform';
import {
  execFileOnHost,
  findSteamPids,
  getRunningSteamGameId,
  isSteamElevated,
  waitForSteamGone,
  waitForSteamStart,
} from '@/main/utils/steam-process';
import type { RestartFailureReason, RestartSteamResult } from '@/shared/types';

const execFileAsync = promisify(execFile);

// ============================================================================
// Flatpak Detection
// ============================================================================

/**
 * Check if we are running inside a Flatpak sandbox
 */
function isRunningInFlatpak(): boolean {
  return !!process.env.FLATPAK_ID;
}

// The sandbox environment is not forwarded by flatpak-spawn, so extra variables go through --env.
function spawnOnHost(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {}
): ChildProcess {
  if (isRunningInFlatpak()) {
    const envArgs = Object.entries(env).map(([key, value]) => `--env=${key}=${value}`);
    const child = spawn('flatpak-spawn', ['--host', ...envArgs, command, ...args], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (err) => {
      console.error(`[Steam] Error spawning flatpak-spawn for ${command}:`, err);
    });
    child.unref();
    return child;
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...env },
  });
  child.on('error', (err) => {
    console.error(`[Steam] Error spawning ${command}:`, err);
  });
  child.unref();
  return child;
}

// ============================================================================
// Types
// ============================================================================

type SteamInstallationType = 'native' | 'flatpak' | 'snap' | 'unknown';

interface LaunchResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Steam Installation Detection (Linux)
// ============================================================================

/**
 * Detect Steam installation type on Linux
 */
export function detectLinuxSteamType(): SteamInstallationType {
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
    if (isRunningInFlatpak()) {
      execSync('flatpak-spawn --host which steam', { stdio: 'ignore' });
    } else {
      execSync('which steam', { stdio: 'ignore' });
    }
    return 'native';
  } catch {
    // If we're in Flatpak and can't find native steam, check if Flatpak Steam is installed
    if (isRunningInFlatpak()) {
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

// ============================================================================
// Process Management
// ============================================================================

type ShutdownResult =
  | { ok: true }
  | { ok: false; reason: Exclude<RestartFailureReason, 'launch-failed'> };

const GRACEFUL_EXIT_TIMEOUT_MS = 30000;
const FORCED_EXIT_TIMEOUT_MS = 5000;
const EXEC_TIMEOUT_MS = 10000;
const MILLENNIUM_WRAPPER_START_TIMEOUT_MS = 15000;
const MILLENNIUM_ASSETS_ROOT_ENV = 'MILLENNIUM_ASSETS_ROOT';
const MILLENNIUM_WRAPPER_ASSETS = 'Contents/Resources/millennium-assets';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function isSteamRunning(): Promise<boolean> {
  return (await findSteamPids()).length > 0;
}

function getTaskkillPath(): string {
  return path.win32.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'taskkill.exe'
  );
}

async function requestGracefulExit(): Promise<void> {
  try {
    if (isWindows()) {
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
    } else if (isLinux()) {
      const steamType = detectLinuxSteamType();
      if (steamType === 'flatpak') {
        await execFileOnHost('flatpak', ['run', 'com.valvesoftware.Steam', '-shutdown']);
      } else if (steamType === 'snap') {
        await execFileOnHost('snap', ['run', 'steam', '-shutdown']);
      } else {
        await execFileOnHost('steam', ['-shutdown']);
      }
    } else if (isMacOS()) {
      // No Automation (TCC) prompt, unlike osascript; Steam ignores steam://ExitSteam.
      await execFileAsync('/usr/bin/open', ['-g', 'steam://exit'], {
        timeout: EXEC_TIMEOUT_MS,
      });
    }
  } catch (error) {
    console.warn('[Steam] Graceful shutdown request failed:', describeError(error));
  }
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

// Returns true when Windows refused to kill a Steam process that is still alive.
async function forceKillSteam(steamPids: number[]): Promise<boolean> {
  if (isWindows()) {
    let denied = false;
    for (const pid of steamPids) {
      try {
        await execFileAsync(getTaskkillPath(), ['/F', '/PID', String(pid)], {
          timeout: EXEC_TIMEOUT_MS,
          windowsHide: true,
        });
      } catch (error) {
        // Exit code 1 is "access denied" or "not found"; the localized text is never parsed.
        if ((error as { code?: unknown }).code === 1) {
          denied = true;
        }
      }
    }
    await execFileAsync(getTaskkillPath(), ['/F', '/IM', 'steamwebhelper.exe'], {
      timeout: EXEC_TIMEOUT_MS,
      windowsHide: true,
    }).catch(() => void 0);
    return denied && (await findSteamPids()).length > 0;
  }

  if (isLinux()) {
    if (detectLinuxSteamType() === 'flatpak') {
      await execFileOnHost('flatpak', ['kill', 'com.valvesoftware.Steam']).catch(
        () => void 0
      );
    }
    await pkill('TERM', 'steam');
    if (!(await waitForSteamGone(FORCED_EXIT_TIMEOUT_MS))) {
      await pkill('KILL', 'steam');
      await pkill('KILL', 'steamwebhelper');
    }
    return false;
  }

  if (isMacOS()) {
    await pkill('TERM', 'steam_osx');
    if (!(await waitForSteamGone(FORCED_EXIT_TIMEOUT_MS))) {
      await pkill('KILL', 'steam_osx');
      await pkill('KILL', 'Steam Helper');
    }
  }
  return false;
}

async function shutdownSteam(): Promise<ShutdownResult> {
  // Must come first: `steam -shutdown` and steam://exit start Steam when it is not up.
  const steamPids = await findSteamPids();
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
  if (await forceKillSteam(await findSteamPids())) {
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

// ============================================================================
// Steam Launching
// ============================================================================

/**
 * Launch Steam with optional URL (e.g., steam://rungameid/123)
 */
function launchSteamLinux(url?: string): boolean {
  const steamType = detectLinuxSteamType();
  const args = url ? [url] : [];
  const env = millenniumLaunchEnv();

  console.log(
    `[Steam] Launching Steam (${steamType})${url ? ` with URL: ${url}` : ''}${isRunningInFlatpak() ? ' [from Flatpak]' : ''}`
  );

  try {
    switch (steamType) {
      case 'flatpak':
        spawnOnHost('flatpak', ['run', 'com.valvesoftware.Steam', ...args]);
        return true;

      case 'snap':
        spawnOnHost('snap', ['run', 'steam', ...args]);
        return true;

      case 'native':
        spawnOnHost('steam', args, env);
        return true;

      default:
        // Try native first, then xdg-open as fallback
        try {
          spawnOnHost('steam', args, env);
          return true;
        } catch {
          if (url) {
            spawnOnHost('xdg-open', [url]);
            return true;
          }
        }
        return false;
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
      describeError(error)
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
    console.error('[Steam] Failed to open Steam URL:', describeError(error));
    return false;
  }
}

/**
 * Launch Steam (cross-platform) (internal)
 */
async function launchSteam(url?: string): Promise<boolean> {
  if (isLinux()) {
    return launchSteamLinux(url);
  }

  if (isMacOS()) {
    const wrapper = findMacMillenniumWrapper();
    if (
      wrapper &&
      !(await isSteamRunning()) &&
      (await launchSteamViaMillenniumWrapper(wrapper, url))
    ) {
      return true;
    }
  }

  // Windows/macOS: use shell.openExternal
  const { shell } = await import('electron');
  const steamUrl = url || 'steam://';

  try {
    await shell.openExternal(steamUrl);
    return true;
  } catch (error) {
    console.error('[Steam] Failed to launch Steam:', error);
    return false;
  }
}

/**
 * Launch a Steam game by App ID
 */
export async function launchSteamGame(appId: string | number): Promise<LaunchResult> {
  const url = `steam://rungameid/${appId}`;
  console.log(`[Steam] Launching game with App ID: ${appId}`);

  const success = await launchSteam(url);
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
          describeError(error)
        );
      }
    }

    if (await launchSteam()) {
      console.log('[Steam] Steam restart initiated');
      return { success: true };
    }
    return { success: false, reason: 'launch-failed', error: 'Failed to launch Steam' };
  } catch (error) {
    console.error('[Steam] Failed to restart Steam:', error);
    return { success: false, reason: 'launch-failed', error: describeError(error) };
  }
}
