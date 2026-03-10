import { exec, spawn } from 'child_process';
import { clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Game, InstallationStatus } from '../../shared/types';
import { getSteamPath } from '../game-detector';
import { getPlatform, isLinux, isWindows } from '../utils/platform';
import { getTransliteratedPath } from '../utils/files';

/**
 * Check if file is an executable installer
 */
function isExecutableInstaller(fileName: string): boolean {
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

  if (isLinuxOS && game.installation_file_windows_path) {
    return game.installation_file_windows_path;
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
 * Run installer file from extracted archive and wait for it to complete
 */
export async function runInstaller(
  extractDir: string,
  installerFileName: string,
  onStatus?: (status: InstallationStatus) => void,
  protonPath?: string
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

    onStatus?.({ message: 'Запуск інсталятора...' });

    if (platform === 'linux' && protonPath) {
      // Use Proton on Linux if protonPath is provided
      console.log(`[Installer] Launching installer via Proton: ${protonPath}`);
      const { runProton } = await import('./proton');

      // Copy installer path in Wine format to clipboard for user convenience
      const winePath = `Z:${path.dirname(installerPath).replace(/\//g, '\\')}`;
      clipboard.writeText(winePath);

      onStatus?.({ message: 'Налаштування та запуск Proton' });

      const exitCode = await runProton({ protonPath, filePath: installerPath });
      if (exitCode !== null) {
        console.log(`[Installer] Installer exited with code: ${exitCode}`);
        if (exitCode === 1) throw new Error('встановлення не було завершене');
      }
    } else {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(installerPath, [], {
          stdio: 'ignore',
          detached: false,
        });

        child.on('exit', (code) => {
          console.log(`[Installer] Installer exited with code: ${code}`);
          if (code !== null && code !== 0) {
            reject(new Error(`${code} код помилки`));
          } else {
            resolve();
          }
        });

        child.on('error', (err) => {
          console.error('[Installer] Failed to launch installer:', err);
          reject(err);
        });
      });
    }

    console.log('[Installer] Installer completed successfully');
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

/**
 * Run uninstaller with /uninstall parameter and wait for it to complete
 * Then delete the installer file
 */
export async function runUninstaller(
  installerPath: string,
  protonPath?: string
): Promise<void> {
  try {
    if (!fs.existsSync(installerPath)) {
      const enFilePath = getTransliteratedPath(installerPath);
      if (fs.existsSync(enFilePath)) {
        installerPath = enFilePath;
        console.log(
          `[Installer] Found transliterated uninstaller file: ${installerPath}`
        );
      } else {
        console.warn(`[Installer] Uninstaller file not found: ${installerPath}`);
        return;
      }
    }

    console.log(`[Installer] Running uninstaller: ${installerPath}`);

    const platform = getPlatform();

    if (platform === 'linux' && protonPath) {
      // Use Proton on Linux if protonPath is provided
      console.log(`[Installer] Launching uninstaller via Proton: ${protonPath}`);
      const { runProton } = await import('./proton');

      const exitCode = await runProton({ protonPath, filePath: installerPath });
      console.log(`[Installer] Uninstaller exited with code: ${exitCode}`);
    } else if (platform === 'windows') {
      // On Windows, run the installer with /uninstall parameter and wait for it to complete
      await new Promise<void>((resolve, reject) => {
        const child = spawn(installerPath, ['/uninstall'], {
          stdio: 'ignore',
          detached: false,
        });

        child.on('exit', (code) => {
          console.log(`[Installer] Uninstaller exited with code: ${code}`);
          resolve();
        });

        child.on('error', (err) => {
          console.error('[Installer] Uninstaller error:', err);
          reject(err);
        });
      });
    } else {
      // For macOS or Linux without Proton, just make executable and run with /uninstall
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${installerPath}"`, (error) => {
          if (error) {
            console.warn('[Installer] Failed to make uninstaller executable:', error);
            // Continue anyway
          }

          const child = spawn(installerPath, ['/uninstall'], {
            stdio: 'ignore',
            detached: false,
          });

          child.on('exit', (code) => {
            console.log(`[Installer] Uninstaller exited with code: ${code}`);
            resolve();
          });

          child.on('error', (err) => {
            console.error('[Installer] Uninstaller error:', err);
            reject(err);
          });
        });
      });
    }

    // Delete the installer file after uninstallation is complete
    console.log(`[Installer] Deleting uninstaller file: ${installerPath}`);
    try {
      await fs.promises.unlink(installerPath);
      console.log(`[Installer] Uninstaller file deleted successfully`);
    } catch (deleteError) {
      console.warn(`[Installer] Failed to delete uninstaller file:`, deleteError);
      // Don't throw - uninstallation succeeded even if we can't delete the file
    }

    console.log('[Installer] Uninstaller completed successfully');
  } catch (error) {
    console.error('[Installer] Error running uninstaller:', error);
    throw new Error(
      `Не вдалося запустити деінсталятор: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Re-run existing installer without downloading again
 * Used when user wants to modify installation without re-downloading
 */
export async function rerunInstaller(
  installerPath: string,
  protonPath?: string
): Promise<void> {
  if (!fs.existsSync(installerPath)) {
    const enFilePath = getTransliteratedPath(installerPath);
    if (fs.existsSync(enFilePath)) {
      installerPath = enFilePath;
      console.log(
        `[Installer] Found transliterated uninstaller file: ${installerPath}`
      );
    } else {
      throw new Error('файл інсталятора не знайдено');
    }
  }


  const extractDir = path.dirname(installerPath);
  const installerFileName = path.basename(installerPath);

  await runInstaller(extractDir, installerFileName, undefined, protonPath);
}