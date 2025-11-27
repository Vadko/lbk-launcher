import { app, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { fetchGames } from './api';
import { getFirstAvailableGamePath } from './game-detector';
import { InstallationInfo } from '../shared/types';

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
  customGamePath?: string
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
      const platformPath = platform === 'steam' ? game.install_paths.steam :
                          platform === 'gog' ? game.install_paths.gog : undefined;

      // Special error to indicate manual folder selection needed
      throw Object.assign(
        new Error(
          `Гру не знайдено автоматично.\n\n` +
          `Шукали папку: ${platformPath || 'не вказано'}\n\n` +
          `Оберіть папку з грою вручну.`
        ),
        { needsManualSelection: true }
      );
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
    const downloadUrl = getArchiveDownloadUrl(game.archive_path);

    console.log(`[Installer] Downloading from Supabase: ${downloadUrl}`);
    console.log(`[Installer] Saving to: ${archivePath}`);

    await downloadFile(downloadUrl, archivePath, (downloadProgress) => {
      // Map download progress to 20-70%
      const overallProgress = 20 + downloadProgress * 0.5;
      onProgress?.(overallProgress);
    });

    onProgress?.(70);

    // 4. Extract archive
    const extractDir = path.join(downloadDir, `${gameId}_extract`);
    await extractArchive(archivePath, extractDir);

    onProgress?.(80);

    // 5. Copy files to game directory
    // installPaths is only used for finding the game
    const fullTargetPath = gamePath.path;

    console.log(`[Installer] Installing to: ${fullTargetPath}`);

    await copyDirectory(extractDir, fullTargetPath);

    onProgress?.(95);

    // 6. Cleanup
    await cleanup(archivePath, extractDir);

    onProgress?.(100);

    // 7. Save installation info
    await saveInstallationInfo(gamePath.path, {
      gameId: game.id,
      version: game.version,
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
    });

    console.log(`[Installer] Translation for ${gameId} installed successfully at ${fullTargetPath}`);
  } catch (error) {
    console.error('[Installer] Installation error:', error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error(
          'Не вдалося завантажити файл перекладу.\n\n' +
            'Можливі причини:\n' +
            '• Сервер недоступний\n' +
            '• Перевірте підключення до Інтернету\n' +
            '• URL завантаження може бути неправильним'
        );
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          'Не вдалося підключитися до сервера.\n\n' +
            'Перевірте підключення до Інтернету та спробуйте ще раз.'
        );
      }
    }

    throw error;
  }
}

/**
 * Download file from URL with progress tracking
 */
export async function downloadFile(
  url: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Downloader] Starting download: ${url}`);

    const request = net.request(url);
    const writeStream = fs.createWriteStream(outputPath);
    let downloadedBytes = 0;
    let totalBytes = 0;

    request.on('response', (response) => {
      console.log(`[Downloader] Response status: ${response.statusCode}`);
      // Handle redirects
      const statusCode = response.statusCode;
      if (
        statusCode === 301 ||
        statusCode === 302 ||
        statusCode === 307 ||
        statusCode === 308
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          const url = typeof redirectUrl === 'string' ? redirectUrl : redirectUrl[0];
          console.log(`Following redirect to: ${url}`);
          writeStream.close();
          downloadFile(url, outputPath, onProgress).then(resolve).catch(reject);
          return;
        }
      }

      if (statusCode !== 200) {
        writeStream.close();
        reject(new Error(`Failed to download: HTTP ${statusCode}`));
        return;
      }

      const contentLength = response.headers['content-length'];
      const lengthStr = typeof contentLength === 'string' ? contentLength : contentLength?.[0] || '0';
      totalBytes = parseInt(lengthStr, 10) || 0;

      response.on('data', (chunk) => {
        writeStream.write(chunk);
        downloadedBytes += chunk.length;

        if (onProgress && totalBytes > 0) {
          const progress = (downloadedBytes / totalBytes) * 100;
          onProgress(progress);
        }
      });

      response.on('end', () => {
        writeStream.end();
        resolve();
      });

      response.on('error', (error: Error) => {
        writeStream.close();
        reject(error);
      });
    });

    request.on('error', (error) => {
      console.error(`[Downloader] Request error:`, error);
      console.error(`[Downloader] Failed URL: ${url}`);
      writeStream.close();
      reject(error);
    });

    writeStream.on('error', (error) => {
      writeStream.close();
      reject(error);
    });

    request.end();
  });
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

    // Detect game installation path
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
