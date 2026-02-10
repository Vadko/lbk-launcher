/**
 * Steam Launcher Utilities
 * Unified logic for launching and restarting Steam across platforms
 */

import { type ChildProcess, exec, execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { promisify } from 'util';
import { isLinux, isMacOS, isWindows } from './platform';

const execAsync = promisify(exec);

// ============================================================================
// Flatpak Detection
// ============================================================================

/**
 * Check if we are running inside a Flatpak sandbox
 */
function isRunningInFlatpak(): boolean {
  return !!process.env.FLATPAK_ID;
}

/**
 * Execute a command on the host system when running inside Flatpak
 * Uses flatpak-spawn --host to break out of the sandbox
 */
function execOnHost(command: string): Promise<{ stdout: string; stderr: string }> {
  if (isRunningInFlatpak()) {
    return execAsync(`flatpak-spawn --host ${command}`);
  }
  return execAsync(command);
}

/**
 * Spawn a process on the host system when running inside Flatpak
 */
function spawnOnHost(command: string, args: string[] = []): ChildProcess {
  if (isRunningInFlatpak()) {
    const child = spawn('flatpak-spawn', ['--host', command, ...args], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return child;
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
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

/**
 * Check if Steam is running
 */
async function isSteamRunning(): Promise<boolean> {
  try {
    if (isWindows()) {
      await execAsync('tasklist /FI "IMAGENAME eq steam.exe" | findstr steam.exe');
      return true;
    }
    if (isLinux()) {
      await execOnHost('pgrep -x steam');
      return true;
    }
    if (isMacOS()) {
      await execAsync('pgrep -x Steam');
      return true;
    }
  } catch {
    // Process not found
  }
  return false;
}

/**
 * Wait for Steam process to exit
 */
async function waitForSteamExit(timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!(await isSteamRunning())) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

/**
 * Gracefully shutdown Steam
 */
async function shutdownSteam(): Promise<void> {
  const running = await isSteamRunning();
  if (!running) {
    console.log('[Steam] Steam is not running, skipping shutdown');
    return;
  }

  console.log('[Steam] Shutting down Steam...');

  if (isWindows()) {
    // Windows: taskkill - if graceful fails, force kill
    await execAsync('taskkill /IM steam.exe').catch(() =>
      execAsync('taskkill /F /IM steam.exe').catch(() => void 0)
    );
  } else if (isLinux()) {
    // Linux: try steam -shutdown first (graceful), then pkill
    const steamType = detectLinuxSteamType();

    try {
      if (steamType === 'flatpak') {
        await execOnHost('flatpak run com.valvesoftware.Steam -shutdown');
      } else if (steamType === 'snap') {
        await execOnHost('snap run steam -shutdown');
      } else {
        await execOnHost('steam -shutdown');
      }
    } catch {
      console.log('[Steam] Graceful shutdown failed, using pkill...');
      await execOnHost('pkill -TERM steam').catch(() => void 0);
    }
  } else if (isMacOS()) {
    // macOS: osascript for graceful quit, then pkill
    await execAsync('osascript -e \'quit app "Steam"\'').catch(() =>
      execAsync('pkill -TERM Steam').catch(() => void 0)
    );
  }

  // Wait for process to exit
  const exited = await waitForSteamExit();
  if (!exited) {
    console.warn('[Steam] Steam did not exit gracefully, force killing...');
    if (isWindows()) {
      await execAsync('taskkill /F /IM steam.exe').catch(() => void 0);
    } else {
      await execOnHost('pkill -9 steam').catch(() => void 0);
    }
    await waitForSteamExit(3000);
  }

  console.log('[Steam] Steam shutdown complete');
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
        spawnOnHost('steam', args);
        return true;

      default:
        // Try native first, then xdg-open as fallback
        try {
          spawnOnHost('steam', args);
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

/**
 * Launch Steam (cross-platform) (internal)
 */
async function launchSteam(url?: string): Promise<boolean> {
  if (isLinux()) {
    return launchSteamLinux(url);
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

/**
 * Restart Steam (shutdown and launch)
 */
export async function restartSteam(): Promise<LaunchResult> {
  console.log('[Steam] Restarting Steam...');

  try {
    await shutdownSteam();

    const success = await launchSteam();

    if (success) {
      console.log('[Steam] Steam restart initiated');
      return { success: true };
    }
    return { success: false, error: 'Failed to launch Steam' };
  } catch (error) {
    console.error('[Steam] Failed to restart Steam:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
