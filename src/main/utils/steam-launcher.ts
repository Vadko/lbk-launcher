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

  if (existsSync(`${home}/.var/app/com.valvesoftware.Steam`)) {
    return 'flatpak';
  }

  if (existsSync(`${home}/snap/steam`)) {
    return 'snap';
  }

  // Check if native steam command exists
  try {
    execSync('which steam', { stdio: 'ignore' });
    return 'native';
  } catch {
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
    } else if (isLinux()) {
      await execAsync('pgrep -x steam');
      return true;
    } else if (isMacOS()) {
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
    // Windows: taskkill
    await execAsync('taskkill /IM steam.exe').catch(() => {
      // If graceful fails, force kill
      return execAsync('taskkill /F /IM steam.exe').catch(() => void 0);
    });
  } else if (isLinux()) {
    // Linux: try steam -shutdown first (graceful), then pkill
    const steamType = detectLinuxSteamType();

    try {
      if (steamType === 'flatpak') {
        await execAsync('flatpak run com.valvesoftware.Steam -shutdown');
      } else if (steamType === 'snap') {
        await execAsync('snap run steam -shutdown');
      } else {
        await execAsync('steam -shutdown');
      }
    } catch {
      console.log('[Steam] Graceful shutdown failed, using pkill...');
      await execAsync('pkill -TERM steam').catch(() => void 0);
    }
  } else if (isMacOS()) {
    // macOS: osascript for graceful quit, then pkill
    await execAsync('osascript -e \'quit app "Steam"\'').catch(() => {
      return execAsync('pkill -TERM Steam').catch(() => void 0);
    });
  }

  // Wait for process to exit
  const exited = await waitForSteamExit();
  if (!exited) {
    console.warn('[Steam] Steam did not exit gracefully, force killing...');
    if (isWindows()) {
      await execAsync('taskkill /F /IM steam.exe').catch(() => void 0);
    } else {
      await execAsync('pkill -9 steam').catch(() => void 0);
    }
    await waitForSteamExit(3000);
  }

  console.log('[Steam] Steam shutdown complete');
}

// ============================================================================
// Steam Launching
// ============================================================================

/**
 * Spawn a detached process that won't block the app
 */
function spawnDetached(command: string, args: string[] = []): ChildProcess {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

/**
 * Launch Steam with optional URL (e.g., steam://rungameid/123)
 */
async function launchSteamLinux(url?: string): Promise<boolean> {
  const steamType = detectLinuxSteamType();
  const args = url ? [url] : [];

  console.log(`[Steam] Launching Steam (${steamType})${url ? ` with URL: ${url}` : ''}`);

  try {
    switch (steamType) {
      case 'flatpak':
        spawnDetached('flatpak', ['run', 'com.valvesoftware.Steam', ...args]);
        return true;

      case 'snap':
        spawnDetached('snap', ['run', 'steam', ...args]);
        return true;

      case 'native':
        spawnDetached('steam', args);
        return true;

      default:
        // Try native first, then xdg-open as fallback
        try {
          spawnDetached('steam', args);
          return true;
        } catch {
          if (url) {
            spawnDetached('xdg-open', [url]);
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
