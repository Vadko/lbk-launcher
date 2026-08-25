import { type ChildProcess, type StdioOptions, spawn } from 'child_process';
import { clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Game, InstallationStatus } from '../../shared/types';
import { getSteamPath } from '../game-detector';
import { getTransliteratedPath } from '../utils/files';
import type { GameBuildOs } from '../utils/game-build';
import { getPlatform, isLinux, isWindows } from '../utils/platform';
import { isCmdSafePath } from '../utils/shell-safety';
import { getCleanEnv } from './archive';
import { readInstallationInfo, saveInstallationInfo } from './cache';
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

const toPosix = (p: string): string => p.replace(/\\/g, '/');

/**
 * Add execute permission without going through a shell. The `chmod +x "${path}"`
 * this replaces interpolated a database-supplied path into a command string, so
 * a value containing a quote could run anything. `+x` was additive, hence the
 * bitwise or rather than a flat 0o755.
 */
async function makeExecutable(filePath: string): Promise<void> {
  const { mode } = await fs.promises.stat(filePath);
  await fs.promises.chmod(filePath, (mode & 0o7777) | 0o111);
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
export function getInstallerFileName(game: Game, buildOs?: GameBuildOs): string | null {
  const isWindowsOS = isWindows();
  const isLinuxOS = isLinux();
  const isMacOS = !isWindowsOS && !isLinuxOS;

  // Match the archive, picked the same way; another build's file isn't inside it.
  if (buildOs === 'windows' && game.installation_file_windows_path) {
    return isWindowsOS
      ? game.installation_file_windows_path
      : toPosix(game.installation_file_windows_path);
  }
  if (buildOs && buildOs !== 'windows' && game.installation_file_linux_path) {
    return toPosix(game.installation_file_linux_path);
  }

  if (isWindowsOS && game.installation_file_windows_path) {
    return game.installation_file_windows_path;
  }

  // Linux and macOS can both run shell scripts
  if ((isLinuxOS || isMacOS) && game.installation_file_linux_path) {
    return toPosix(game.installation_file_linux_path);
  }

  if (isLinuxOS && game.installation_file_windows_path) {
    return toPosix(game.installation_file_windows_path);
  }

  return null;
}

/**
 * Check if game has an executable installer (not just any installation file)
 */
export function hasExecutableInstaller(game: Game): boolean {
  const installerFileName = getInstallerFileName(game);
  if (!installerFileName) {
    return false;
  }
  return isExecutableInstaller(installerFileName);
}

/** Only `.bat`/`.cmd` need a shell; everything else spawns directly. */
function isWindowsBatchFile(installerPath: string): boolean {
  return /\.(bat|cmd)$/i.test(installerPath);
}

/**
 * Spawn an installer on Windows. A `.bat` cannot be spawned without `cmd.exe`,
 * so its path is interpolated into a command string — vetted first, since it is
 * the translation database's value joined onto the player's game folder. An
 * `.exe` goes through an argument array and never sees a shell.
 *
 * Throws rather than rejecting: both callers run this inside a Promise
 * executor, which turns a throw into a rejection.
 */
function spawnWindowsInstaller(
  installerPath: string,
  args: string[],
  stdio: StdioOptions
): ChildProcess {
  const options = { cwd: path.dirname(installerPath), stdio, detached: false };

  if (!isWindowsBatchFile(installerPath)) {
    return spawn(installerPath, args, options);
  }
  if (!isCmdSafePath(installerPath)) {
    throw new Error(
      `шлях містить символи, небезпечні для командного рядка: ${installerPath}`
    );
  }
  return spawn(`"${installerPath}"`, args, { ...options, shell: true });
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
      await makeExecutable(installerPath);
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
        if (exitCode === 1) {
          throw new Error('встановлення не було завершене');
        }
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
        const isAppImage = installerPath.toLowerCase().endsWith('.appimage');
        // On Linux: drop Steam's 32-bit LD_PRELOAD (breaks 64-bit Electron
        // child processes — GPU/ICU init fails). APPIMAGE_EXTRACT_AND_RUN
        // bypasses FUSE for AppImages. ELECTRON_DISABLE_SANDBOX lets
        // Electron-based installers run when chrome-sandbox can't be setuid
        // root (Flatpak, AppImage-extracted /tmp on Steam Deck). All env vars
        // propagate to wrapper scripts (.sh/.run/.bin) that nest AppImages.
        const env: NodeJS.ProcessEnv = isLinux()
          ? { ...getCleanEnv(), ELECTRON_DISABLE_SANDBOX: '1' }
          : { ...process.env };
        if (isAppImage) {
          env.APPIMAGE_EXTRACT_AND_RUN = '1';
        }

        const child = spawn(installerPath, [], {
          cwd: extractDir,
          stdio: ['inherit', 'pipe', 'pipe'],
          env,
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
        const isBatch = isWindowsBatchFile(installerPath);
        const child = spawnWindowsInstaller(
          installerPath,
          [],
          isBatch ? ['ignore', 'pipe', 'pipe'] : 'ignore'
        );

        const stderrLines: string[] = [];
        // Add output capturing for batch files
        if (isBatch) {
          child.stdout?.on('data', (data) => {
            const line = data.toString('utf8').trim();
            if (line) {
              console.log(`[Installer stdout] ${line}`);
            }
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
      await makeExecutable(installerPath);

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
        const child = spawnWindowsInstaller(installerPath, args, 'pipe');

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

    // Installer ran successfully this time — clear a stale error badge left
    // over from a previous failed/declined run.
    const existingInfo = readInstallationInfo(extractDir);
    if (existingInfo?.hasInstallError) {
      await saveInstallationInfo(extractDir, { ...existingInfo, hasInstallError: false });
    }
  } catch (error) {
    console.error('[Installer] Error re-running installer:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Повторний запуск інсталятора не вдався'
    );
  }
}
