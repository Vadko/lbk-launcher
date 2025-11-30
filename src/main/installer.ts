import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import AdmZip from 'adm-zip';
import got from 'got';
import { fetchGames } from './api';
import { getFirstAvailableGamePath } from './game-detector';
import { InstallationInfo, Game } from '../shared/types';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

const INSTALLATION_INFO_FILE = '.littlebit-translation.json';

/**
 * Main installation function
 */
export async function installTranslation(
  gameId: string,
  platform: string,
  onProgress?: (progress: number) => void,
  customGamePath?: string,
  onDownloadProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    onProgress?.(5);

    // 1. Fetch game metadata
    const games = await fetchGames();
    const game = games.find((g) => g.id === gameId);

    if (!game) {
      throw new Error(`Гру ${gameId} не знайдено`);
    }

    console.log(`[Installer] Installing translation for: ${game.name} (${gameId})`);
    console.log(`[Installer] Install paths config:`, JSON.stringify(game.install_paths, null, 2));
    console.log(`[Installer] Requested platform: ${platform}`);

    onProgress?.(10);

    // 2. Detect game installation path
    const gamePath = customGamePath
      ? { platform, path: customGamePath, exists: true }
      : getFirstAvailableGamePath(game.install_paths);

    if (!gamePath || !gamePath.exists) {
      console.error(`[Installer] Game not found. Searched paths:`, game.install_paths);
      const platformPath = game.install_paths.find(p => p.type === platform)?.path;

      // Special error to indicate manual folder selection needed
      const error: any = new Error(
        `Гру не знайдено автоматично.\n\n` +
        `Шукали папку: ${platformPath || 'не вказано'}\n\n` +
        `Оберіть папку з грою вручну.`
      );
      error.needsManualSelection = true;
      throw error;
    }

    console.log(`[Installer] ✓ Game found at: ${gamePath.path} (${gamePath.platform})`);
    onProgress?.(20);

    // 3. Download translation archive from Supabase Storage
    const tempDir = app.getPath('temp');
    const downloadDir = path.join(tempDir, 'little-bit-downloads');
    await mkdir(downloadDir, { recursive: true });

    const archivePath = path.join(downloadDir, `${gameId}_translation.zip`);

    // Get download URL from Supabase Storage
    const { getArchiveDownloadUrl } = await import('../lib/api');

    if (!game.archive_path) {
      throw new Error('Архів перекладу не знайдено');
    }

    const downloadUrl = getArchiveDownloadUrl(game.archive_path);

    console.log(`[Installer] Downloading from Supabase: ${downloadUrl}`);
    console.log(`[Installer] Saving to: ${archivePath}`);

    await downloadFile(downloadUrl, archivePath, (downloadProgress) => {
      // Map download progress to 20-70%
      const overallProgress = 20 + downloadProgress.percent * 0.5;
      onProgress?.(overallProgress);
      onDownloadProgress?.(downloadProgress);
    });

    onProgress?.(70);

    // 4. Extract archive
    const extractDir = path.join(downloadDir, `${gameId}_extract`);
    await extractArchive(archivePath, extractDir);

    onProgress?.(80);

    // 5. Check for installer file and run if present
    const installerFileName = getInstallerFileName(game);
    if (installerFileName) {
      console.log(`[Installer] Found installer file: ${installerFileName}`);
      try {
        await runInstaller(extractDir, installerFileName);
        console.log(`[Installer] Installer launched successfully. User needs to complete installation.`);
      } catch (error) {
        console.error('[Installer] Failed to launch installer:', error);
        // Don't fail the whole process if installer fails to launch
      }
    }

    // 6. Copy files to game directory
    // installPaths is only used for finding the game
    const fullTargetPath = gamePath.path;

    console.log(`[Installer] Installing to: ${fullTargetPath}`);

    await copyDirectory(extractDir, fullTargetPath);

    onProgress?.(95);

    // 7. Cleanup
    await cleanup(archivePath, extractDir);

    onProgress?.(100);

    // 8. Save installation info
    await saveInstallationInfo(gamePath.path, {
      gameId: game.id,
      version: game.version || '1.0.0',
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
    });

    console.log(`[Installer] Translation for ${gameId} installed successfully at ${fullTargetPath}`);
  } catch (error) {
    console.error('[Installer] Installation error:', error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      // Check if it's already a user-friendly error (e.g., from needsManualSelection)
      if ((error as any).needsManualSelection) {
        throw error;
      }

      // Network errors
      if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error(
          'Не вдалося завантажити переклад.\n\nПеревірте підключення до Інтернету та спробуйте ще раз.'
        );
      }

      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          'Не вдалося підключитися до сервера.\n\nПеревірте підключення до Інтернету.'
        );
      }

      // Permission errors
      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        throw new Error(
          'Недостатньо прав для встановлення.\n\nЗапустіть додаток від імені адміністратора.'
        );
      }

      // Disk space errors
      if (error.message.includes('ENOSPC')) {
        throw new Error(
          'Недостатньо місця на диску.\n\nЗвільніть місце та спробуйте знову.'
        );
      }

      // File not found errors
      if (error.message.includes('ENOENT')) {
        throw new Error(
          'Гру не знайдено на вашому комп\'ютері.\n\nПереконайтеся, що гра встановлена через STEAM.'
        );
      }

      // Generic error - make it more user-friendly
      throw new Error(
        `Помилка встановлення: ${error.message}\n\nСпробуйте ще раз або зверніться до підтримки.`
      );
    }

    throw new Error('Невідома помилка встановлення.\n\nСпробуйте ще раз.');
  }
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  timeRemaining: number; // in seconds
}

/**
 * Download file from URL with progress tracking
 */
export async function downloadFile(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  console.log(`[Downloader] Starting download: ${url}`);

  const writeStream = fs.createWriteStream(outputPath);
  let startTime = Date.now();
  let lastUpdateTime = Date.now();

  try {
    const downloadStream = got.stream(url, {
      followRedirect: true,
      timeout: {
        lookup: 10000,
        connect: 10000,
        secureConnect: 10000,
        response: 30000,
      },
    });

    downloadStream.on('downloadProgress', (progress) => {
      const { transferred, total, percent } = progress;

      // Throttle updates to every 500ms
      const now = Date.now();
      if (now - lastUpdateTime < 500) {
        return;
      }
      lastUpdateTime = now;

      if (onProgress && total) {
        const elapsedTime = (now - startTime) / 1000; // in seconds
        const bytesPerSecond = elapsedTime > 0 ? transferred / elapsedTime : 0;
        const remainingBytes = total - transferred;
        const timeRemaining = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

        onProgress({
          percent: percent * 100,
          downloadedBytes: transferred,
          totalBytes: total,
          bytesPerSecond,
          timeRemaining,
        });
      }
    });

    await new Promise<void>((resolve, reject) => {
      downloadStream.pipe(writeStream);
      downloadStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    console.log(`[Downloader] Download completed: ${outputPath}`);
  } catch (error) {
    console.error(`[Downloader] Download error:`, error);
    writeStream.close();
    throw new Error(`Не вдалося завантажити файл: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract ZIP archive
 */
async function extractArchive(archivePath: string, extractPath: string): Promise<void> {
  try {
    await mkdir(extractPath, { recursive: true });

    const zip = new AdmZip(archivePath);
    zip.extractAllTo(extractPath, true);

    console.log(`Extracted archive to: ${extractPath}`);
  } catch (error) {
    throw new Error(
      `Помилка розпакування архіву: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Copy directory recursively
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
  try {
    // Create destination directory
    await mkdir(destination, { recursive: true });

    // Read source directory
    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        await copyDirectory(sourcePath, destPath);
      } else {
        // Copy file
        await fs.promises.copyFile(sourcePath, destPath);
      }
    }

    console.log(`Copied files from ${source} to ${destination}`);
  } catch (error) {
    throw new Error(
      `Помилка копіювання файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Cleanup temporary files
 */
async function cleanup(archivePath: string, extractDir: string): Promise<void> {
  try {
    // Delete archive
    if (fs.existsSync(archivePath)) {
      await unlink(archivePath);
    }

    // Delete extracted files
    if (fs.existsSync(extractDir)) {
      await deleteDirectory(extractDir);
    }

    console.log('Cleanup completed');
  } catch (error) {
    console.warn('Cleanup warning:', error);
    // Don't throw error on cleanup failure
  }
}

/**
 * Delete directory recursively
 */
async function deleteDirectory(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) return;

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await deleteDirectory(fullPath);
    } else {
      await unlink(fullPath);
    }
  }

  await fs.promises.rmdir(dirPath);
}

/**
 * Get installer file name based on platform
 */
function getInstallerFileName(game: Game): string | null {
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  if (isWindows && game.installation_file_windows_path) {
    return game.installation_file_windows_path;
  }

  if (isLinux && game.installation_file_linux_path) {
    return game.installation_file_linux_path;
  }

  return null;
}

/**
 * Run installer file from extracted archive
 */
async function runInstaller(extractDir: string, installerFileName: string): Promise<void> {
  try {
    const installerPath = path.join(extractDir, installerFileName);

    if (!fs.existsSync(installerPath)) {
      console.warn(`[Installer] Installer file not found: ${installerPath}`);
      return;
    }

    console.log(`[Installer] Running installer: ${installerPath}`);

    // Determine platform and run installer
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows - run .exe installer
      await shell.openPath(installerPath);
    } else if (platform === 'darwin' || platform === 'linux') {
      // macOS or Linux - make executable and run
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${installerPath}"`, (error) => {
          if (error) {
            console.error('[Installer] Failed to make installer executable:', error);
            reject(error);
            return;
          }

          // Open installer
          shell.openPath(installerPath).then(() => {
            resolve();
          }).catch(reject);
        });
      });
    } else {
      console.warn(`[Installer] Unsupported platform: ${platform}`);
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
 * Save installation info to game directory
 */
async function saveInstallationInfo(
  gamePath: string,
  info: InstallationInfo
): Promise<void> {
  try {
    const infoPath = path.join(gamePath, INSTALLATION_INFO_FILE);
    await fs.promises.writeFile(infoPath, JSON.stringify(info, null, 2), 'utf-8');
    console.log(`[Installer] Installation info saved to: ${infoPath}`);

    // Also save to cache for future lookups (especially for custom paths)
    try {
      const userDataPath = app.getPath('userData');
      const installInfoDir = path.join(userDataPath, 'installation-cache');
      await mkdir(installInfoDir, { recursive: true });
      const cacheInfoPath = path.join(installInfoDir, `${info.gameId}.json`);
      await fs.promises.writeFile(cacheInfoPath, JSON.stringify(info, null, 2), 'utf-8');
      console.log(`[Installer] Installation info cached to: ${cacheInfoPath}`);
    } catch (cacheError) {
      console.warn('[Installer] Failed to cache installation info:', cacheError);
    }
  } catch (error) {
    console.warn('[Installer] Failed to save installation info:', error);
    // Don't throw - installation succeeded even if we can't save the info
  }
}

/**
 * Check if translation is installed and get installation info
 */
export async function checkInstallation(gameId: string): Promise<InstallationInfo | null> {
  try {
    console.log(`[Installer] Checking installation for: ${gameId}`);

    // Fetch game metadata
    const games = await fetchGames();
    const game = games.find((g) => g.id === gameId);

    if (!game) {
      console.warn(`[Installer] Game ${gameId} not found`);
      return null;
    }

    // First, try to find installation info from previous installations
    // This helps when game was installed via manual folder selection
    const previousInstallInfoPath = getPreviousInstallPath(gameId);
    if (previousInstallInfoPath && fs.existsSync(previousInstallInfoPath)) {
      try {
        const infoContent = await fs.promises.readFile(previousInstallInfoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        // Verify the path still exists
        if (fs.existsSync(info.gamePath)) {
          console.log(
            `[Installer] Found previous installation at custom path: ${info.gamePath}`
          );
          return info;
        }
      } catch (error) {
        console.warn('[Installer] Failed to read previous installation info:', error);
      }
    }

    // Detect game installation path from standard locations
    const gamePath = getFirstAvailableGamePath(game.install_paths);

    if (!gamePath || !gamePath.exists) {
      console.log(`[Installer] Game not installed on this computer`);
      return null;
    }

    // Check for installation info file
    const infoPath = path.join(gamePath.path, INSTALLATION_INFO_FILE);

    if (!fs.existsSync(infoPath)) {
      console.log(`[Installer] No translation installed (info file not found)`);
      return null;
    }

    // Read installation info
    const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
    const info: InstallationInfo = JSON.parse(infoContent);

    console.log(
      `[Installer] Translation installed: version ${info.version}, installed at ${info.installedAt}`
    );

    return info;
  } catch (error) {
    console.error('[Installer] Error checking installation:', error);
    return null;
  }
}

/**
 * Get path to the installation info file from a previous installation
 */
function getPreviousInstallPath(gameId: string): string | null {
  try {
    const userDataPath = app.getPath('userData');
    const installInfoDir = path.join(userDataPath, 'installation-cache');
    const installInfoPath = path.join(installInfoDir, `${gameId}.json`);
    return installInfoPath;
  } catch (error) {
    return null;
  }
}
