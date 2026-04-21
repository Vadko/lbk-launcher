import { exec, spawn } from 'child_process';
import { clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Game, InstallationStatus } from '../../shared/types';
import { getSteamPath } from '../game-detector';
import { getTransliteratedPath } from '../utils/files';
import { getPlatform, isLinux, isWindows } from '../utils/platform';
import { runProton } from './proton';

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
 * Check for new Uninstall registry keys in HKLM and HKCU after installer run (Windows only).
 * If new key's DisplayName contains target words, print UninstallString.
 */
async function checkNewUninstallRegistryKeys(
  beforeHKLM: Set<string>,
  beforeHKCU: Set<string>
): Promise<void> {
  try {
    const { execSync } = await import('child_process');

    const checkKey = (key: string, label: string) => {
      try {
        const displayName = execSync(`reg query "${key}" /v DisplayName`).toString();
        const uninstallString = execSync(
          `reg query "${key}" /v UninstallString`
        ).toString();
        const nameMatch = displayName.match(/DisplayName\s+REG_SZ\s+(.+)/);
        const uninstallMatch = uninstallString.match(/UninstallString\s+REG_SZ\s+(.+)/);
        const name = nameMatch ? nameMatch[1].toLowerCase() : '';
        if (
          name.includes('українізатор') ||
          name.includes('українською') ||
          name.includes('localization') ||
          name.includes('ukrainizator')
        ) {
          const uninstallVal = uninstallMatch ? uninstallMatch[1] : '(not found)';
          console.log(`[Installer] New Uninstall registry key detected (${label}):`, key);
          console.log(
            '[Installer]   DisplayName:',
            nameMatch ? nameMatch[1] : '(not found)'
          );
          console.log('[Installer]   UninstallString:', uninstallVal);
        }
      } catch (e) {
        // If DisplayName or UninstallString not found, skip
      }
    };

    // HKLM
    const outputHKLM = execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"'
    ).toString();
    const uninstallKeysAfterHKLM = new Set(
      outputHKLM
        .split('\r\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.startsWith('HKEY'))
    );
    for (const key of uninstallKeysAfterHKLM) {
      if (!beforeHKLM.has(key)) {
        checkKey(key, 'HKLM');
      }
    }
    // HKCU
    const outputHKCU = execSync(
      'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"'
    ).toString();
    const uninstallKeysAfterHKCU = new Set(
      outputHKCU
        .split('\r\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.startsWith('HKEY'))
    );
    for (const key of uninstallKeysAfterHKCU) {
      if (!beforeHKCU.has(key)) {
        checkKey(key, 'HKCU');
      }
    }
  } catch (e) {
    console.warn('[Installer] Failed to read registry keys after installer launch:', e);
  }
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

function formatInstallerExitError(code: number, stderrLines: string[]): string {
  const knownCodes: Record<number, string> = {
    1: 'Встановлення завершилось з помилкою або було скасовано',
    2: 'Встановлення скасовано',
  };

  const description = knownCodes[code] ?? `Інсталятор завершився з кодом ${code}`;
  const stderr =
    stderrLines.length > 0 ? `\n\nВивід інсталятора:\n${stderrLines.join('\n')}` : '';
  return `${description}${stderr}`;
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

    const platform = getPlatform();

    // Windows registry tracking (only for Windows platform)
    let uninstallKeysBeforeHKLM: Set<string> | undefined = undefined;
    let uninstallKeysBeforeHKCU: Set<string> | undefined = undefined;

    if (platform === 'windows') {
      try {
        const { execSync } = await import('child_process');
        // HKLM
        const outputHKLM = execSync(
          'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"'
        ).toString();
        uninstallKeysBeforeHKLM = new Set(
          outputHKLM
            .split('\r\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.startsWith('HKEY'))
        );
        // HKCU
        const outputHKCU = execSync(
          'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"'
        ).toString();
        uninstallKeysBeforeHKCU = new Set(
          outputHKCU
            .split('\r\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.startsWith('HKEY'))
        );
      } catch (e) {
        console.warn(
          '[Installer] Failed to read registry keys before installer launch:',
          e
        );
      }
    }

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

    onStatus?.({ message: 'Запуск інсталятора...', phase: 'install' });

    if (platform === 'linux' && protonPath) {
      // Use Proton on Linux - Wine registry tracking is handled inside runProton
      console.log(`[Installer] Launching installer via Proton: ${protonPath}`);

      // Copy installer path in Wine format to clipboard for user convenience
      const installPath = `Z:${path.dirname(installerPath).replace(/\//g, '\\')}`;
      clipboard.writeText(installPath);

      onStatus?.({ message: 'Налаштування та запуск Proton', phase: 'install' });

      const args = [
        `/installpath=${installPath}`,
        `/DIR=${installPath}`,
        `/INSTALLDIR=${installPath}`,
      ];

      const exitCode = await runProton({
        protonPath,
        filePath: installerPath,
        args,
      });
      if (exitCode !== null) {
        console.log(`[Installer] Installer exited with code: ${exitCode}`);
        if (exitCode === 1) throw new Error('встановлення не було завершене');
      }
    } else if (platform === 'linux' || platform === 'macos') {
      // Check if this is a Windows-specific file that requires Proton
      const isWindowsFile =
        installerPath.toLowerCase().endsWith('.bat') ||
        installerPath.toLowerCase().endsWith('.cmd') ||
        installerPath.toLowerCase().endsWith('.exe') ||
        installerPath.toLowerCase().endsWith('.msi');

      if (isWindowsFile) {
        throw new Error('Windows інсталятор (.bat/.cmd/.exe/.msi) потребує Proton.');
      }

      // Execute native Linux/macOS scripts directly
      console.log(`[Installer] Executing native installer: ${installerPath}`);
      onStatus?.({ message: 'Запуск інсталятора...', phase: 'install' });

      await new Promise<void>((resolve, reject) => {
        // AppImage needs APPIMAGE_EXTRACT_AND_RUN=1 to bypass FUSE
        // (e.g. on Steam Deck or when launched from another AppImage)
        const isAppImage = installerPath.toLowerCase().endsWith('.appimage');
        const env = isAppImage
          ? { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }
          : undefined;

        const child = spawn(installerPath, [], {
          cwd: extractDir,
          stdio: ['inherit', 'pipe', 'pipe'],
          ...(env && { env }),
        });

        child.stdout?.on('data', (data) => {
          console.log(`[Installer stdout] ${data.toString().trim()}`);
        });

        child.stderr?.on('data', (data) => {
          const line = data.toString().trim();
          // Filter out quickbms spinner characters (/-\|)
          if (line && !/^[-\\|/]+$/.test(line)) {
            console.error(`[Installer stderr] ${line}`);
          }
        });

        child.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            reject(new Error(`Інсталятор завершився з кодом ${code}`));
          } else {
            resolve();
          }
        });

        child.on('error', (err) => {
          reject(err);
        });
      });
    } else {
      // Windows platform
      await new Promise<void>((resolve, reject) => {
        const isWindowsBatchFile =
          installerPath.toLowerCase().endsWith('.bat') ||
          installerPath.toLowerCase().endsWith('.cmd');

        const child = isWindowsBatchFile
          ? spawn(`"${installerPath}"`, [], {
              cwd: path.dirname(installerPath),
              stdio: ['ignore', 'pipe', 'pipe'],
              detached: false,
              shell: true,
            })
          : spawn(installerPath, [], {
              cwd: path.dirname(installerPath),
              stdio: 'ignore',
              detached: false,
            });

        const stderrLines: string[] = [];
        // Add output capturing for batch files
        if (isWindowsBatchFile) {
          child.stdout?.on('data', (data) => {
            const line = data.toString('utf8').trim();
            if (line) console.log(`[Installer stdout] ${line}`);
          });

          child.stderr?.on('data', (data) => {
            const line = data.toString('utf8').trim();
            if (line) {
              console.error(`[Installer stderr] ${line}`);
              stderrLines.push(line);
            }
          });
        }

        child.on('exit', (code) => {
          console.log(`[Installer] Installer exited with code: ${code}`);
          if (code !== null && code !== 0) {
            reject(new Error(formatInstallerExitError(code, stderrLines)));
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

    // Check for new Windows registry keys after installer launch
    if (platform === 'windows' && uninstallKeysBeforeHKLM && uninstallKeysBeforeHKCU) {
      await checkNewUninstallRegistryKeys(
        uninstallKeysBeforeHKLM,
        uninstallKeysBeforeHKCU
      );
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
          `[Uninstaller] Found transliterated uninstaller file: ${installerPath}`
        );
      } else {
        console.warn(`[Uninstaller] Uninstaller file not found: ${installerPath}`);
        return;
      }
    }

    console.log(`[Uninstaller] Running uninstaller: ${installerPath}`);

    const platform = getPlatform();

    if (platform === 'linux' && protonPath) {
      // Use Proton on Linux if protonPath is provided
      console.log(`[Uninstaller] Launching uninstaller via Proton: ${protonPath}`);
      const args = ['/uninstall', '/SILENT', '/silent'];
      const exitCode = await runProton({ protonPath, filePath: installerPath, args });

      if (exitCode !== null && exitCode !== 0) {
        console.log(`[Uninstaller] Uninstaller exited with code: ${exitCode}`);
      }
    } else if (platform === 'linux' || platform === 'macos') {
      // Execute natively on Linux/macOS - make executable first
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${installerPath}"`, (error) => {
          if (error) {
            console.error('[Uninstaller] Failed to make uninstaller executable:', error);
            reject(error);
            return;
          }
          resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        const child = spawn(installerPath, ['/uninstall', '/SILENT', '/silent'], {
          cwd: path.dirname(installerPath),
          stdio: 'inherit',
        });

        child.on('exit', (code) => {
          console.log(`[Uninstaller] Uninstaller exited with code: ${code}`);
          resolve();
        });

        child.on('error', (err) => {
          console.error('[Uninstaller] Failed to run uninstaller:', err);
          reject(err);
        });
      });
    } else {
      // Windows
      await new Promise<void>((resolve, reject) => {
        const args = ['/uninstall', '/SILENT', '/silent'];
        const isWindowsBatchFile =
          installerPath.toLowerCase().endsWith('.bat') ||
          installerPath.toLowerCase().endsWith('.cmd');

        const child = isWindowsBatchFile
          ? spawn(`"${installerPath}"`, args, {
              cwd: path.dirname(installerPath),
              stdio: 'pipe',
              detached: false,
              shell: true,
            })
          : spawn(installerPath, args, {
              cwd: path.dirname(installerPath),
              stdio: 'pipe',
              detached: false,
            });

        child.stdin?.end();
        child.stdout?.on('data', (data) => {
          console.log(`[Uninstaller stdout] ${data.toString().trimEnd()}`);
        });
        child.stderr?.on('data', (data) => {
          console.error(`[Uninstaller stderr] ${data.toString().trimEnd()}`);
        });

        child.on('exit', (code) => {
          console.log(`[Uninstaller] Uninstaller exited with code: ${code}`);
          resolve();
        });

        child.on('error', (err) => {
          console.error('[Uninstaller] Failed to run uninstaller:', err);
          reject(err);
        });
      });
    }

    // Delete the uninstaller file after successful execution
    try {
      fs.unlinkSync(installerPath);
      console.log(`[Uninstaller] Deleted uninstaller file: ${installerPath}`);
    } catch (deleteError) {
      console.warn(`[Uninstaller] Failed to delete uninstaller file: ${deleteError}`);
    }

    console.log('[Uninstaller] Uninstaller completed successfully');
  } catch (error) {
    console.error('[Uninstaller] Error running uninstaller:', error);
    throw new Error(
      `Не вдалося запустити деінсталятор: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Rerun installer from a specific path (used for manual installer reruns)
 */
export async function rerunInstaller(
  installerPath: string,
  protonPath?: string
): Promise<void> {
  try {
    if (!fs.existsSync(installerPath)) {
      const enFilePath = getTransliteratedPath(installerPath);
      if (fs.existsSync(enFilePath)) {
        installerPath = enFilePath;
        console.log(`[Installer] Found transliterated installer file: ${installerPath}`);
      } else {
        throw new Error(`файл інсталятора не знайдено: ${installerPath}`);
      }
    }

    const extractDir = path.dirname(installerPath);
    const installerFileName = path.basename(installerPath);

    await runInstaller(extractDir, installerFileName, undefined, protonPath);
  } catch (error) {
    console.error('[Installer] Error re-running installer:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Повторний запуск інсталятора не вдався'
    );
  }
}
