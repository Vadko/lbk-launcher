import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { shell } from 'electron';
import type { Game } from '../../shared/types';
import { isWindows, isLinux, getPlatform } from '../utils/platform';
import { getSteamPath } from '../game-detector';

/**
 * Check if file is an executable installer
 */
export function isExecutableInstaller(fileName: string): boolean {
  const executableExtensions = [
    '.exe',
    '.msi',
    '.bat',
    '.cmd',
    '.sh',
    '.run',
    '.bin',
    '.appimage',
  ];
  const lowerName = fileName.toLowerCase();
  return executableExtensions.some((ext) => lowerName.endsWith(ext));
}

/**
 * Check if game requires a platform-specific installer and if current platform is supported
 * Returns null if compatible, or an error message if not
 */
export function checkPlatformCompatibility(game: Game): string | null {
  const hasWindowsInstaller = !!game.installation_file_windows_path;
  const hasLinuxInstaller = !!game.installation_file_linux_path;

  // If no installers required, compatible with all platforms
  if (!hasWindowsInstaller && !hasLinuxInstaller) {
    return null;
  }

  const isWindowsOS = isWindows();
  const isLinuxOS = isLinux();
  const isMacOS = !isWindowsOS && !isLinuxOS;

  // Windows: needs Windows installer
  if (isWindowsOS && !hasWindowsInstaller) {
    return 'Цей українізатор доступний тільки для Linux. Встановлення на Windows неможливе.';
  }

  // Linux: needs Linux installer
  if (isLinuxOS && !hasLinuxInstaller) {
    return 'Цей українізатор доступний тільки для Windows. Встановлення на Linux неможливе.';
  }

  // macOS: can run Linux shell scripts, but not Windows installers
  if (isMacOS) {
    // If only Windows installer available - block
    if (hasWindowsInstaller && !hasLinuxInstaller) {
      return 'Цей українізатор доступний тільки для Windows. Встановлення на macOS неможливе.';
    }
    // If Linux installer available - allow (macOS can run shell scripts)
  }

  return null;
}

/**
 * Get installer file name based on platform
 */
export function getInstallerFileName(game: Game): string | null {
  const isWindowsOS = isWindows();
  const isLinuxOS = isLinux();
  const isMacOS = !isWindowsOS && !isLinuxOS;

  if (isWindowsOS && game.installation_file_windows_path) {
    return game.installation_file_windows_path;
  }

  // Linux and macOS can both run shell scripts
  if ((isLinuxOS || isMacOS) && game.installation_file_linux_path) {
    return game.installation_file_linux_path;
  }

  return null;
}

/**
 * Check if game has an executable installer (not just any installation file)
 */
export function hasExecutableInstaller(game: Game): boolean {
  const installerFileName = getInstallerFileName(game);
  if (!installerFileName) return false;
  return isExecutableInstaller(installerFileName);
}

/**
 * Run installer file from extracted archive
 */
export async function runInstaller(
  extractDir: string,
  installerFileName: string
): Promise<void> {
  try {
    const installerPath = path.join(extractDir, installerFileName);

    if (!fs.existsSync(installerPath)) {
      console.warn(`[Installer] Installer file not found: ${installerPath}`);
      return;
    }

    console.log(`[Installer] Running installer: ${installerPath}`);

    // Determine platform and run installer
    const platform = getPlatform();

    if (platform === 'macos' || platform === 'linux') {
      // macOS or Linux - make executable first
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${installerPath}"`, (error) => {
          if (error) {
            console.error('[Installer] Failed to make installer executable:', error);
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    // Use Electron's shell.openPath for all platforms
    const result = await shell.openPath(installerPath);

    if (result) {
      // result is an error string if something went wrong
      console.error('[Installer] Failed to launch installer:', result);
      throw new Error(result);
    }

    console.log('[Installer] Installer launched successfully');
  } catch (error) {
    console.error('[Installer] Error running installer:', error);
    throw new Error(
      `Не вдалося запустити інсталятор: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get Steam achievements path (Steam/appcache/stats)
 * Always uses the main Steam installation path, not the game's library folder
 */
export async function getSteamAchievementsPath(): Promise<string | null> {
  try {
    // Always use main Steam installation path (where Steam.exe is located)
    // Achievements must be in the main Steam folder, not in additional libraries
    const steamPath = getSteamPath();

    if (!steamPath) {
      console.warn('[Installer] Steam path not found');
      return null;
    }

    const achievementsPath = path.join(steamPath, 'appcache', 'stats');
    console.log(`[Installer] Steam achievements path: ${achievementsPath}`);
    return achievementsPath;
  } catch (error) {
    console.error('[Installer] Error getting Steam achievements path:', error);
    return null;
  }
}
