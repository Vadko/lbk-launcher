import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createHash } from 'crypto';
import StreamZip from 'node-stream-zip';
import got from 'got';
import { getFirstAvailableGamePath } from './game-detector';
import { InstallationInfo, Game } from '../shared/types';
import { formatBytes } from '../shared/formatters';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

const INSTALLATION_INFO_FILE = '.littlebit-translation.json';
const BACKUP_DIR_NAME = '.littlebit-backup';

// Глобальний AbortController для скасування поточного завантаження
let currentDownloadAbortController: AbortController | null = null;

/**
 * Скасувати поточне завантаження
 */
export function abortCurrentDownload(): void {
  if (currentDownloadAbortController) {
    console.log('[Installer] Aborting current download due to connection loss');
    currentDownloadAbortController.abort('Завантаження скасовано через відсутність підключення до Інтернету');
    currentDownloadAbortController = null;
  }
}

/**
 * Main installation function
 */
export interface InstallationStatus {
  message: string;
}

export async function installTranslation(
  game: Game,
  platform: string,
  customGamePath?: string,
  createBackup: boolean = true,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  try {
    console.log(`[Installer] Installing translation for: ${game.name} (${game.id})`);
    console.log(`[Installer] Install paths config:`, JSON.stringify(game.install_paths, null, 2));
    console.log(`[Installer] Requested platform: ${platform}`);

    // 2. Detect game installation path
    const gamePath = customGamePath
      ? { platform, path: customGamePath, exists: true }
      : getFirstAvailableGamePath(game.install_paths || []);

    if (!gamePath || !gamePath.exists) {
      console.error(`[Installer] Game not found. Searched paths:`, game.install_paths);
      const platformPath = (game.install_paths || []).find(p => p.type === platform)?.path;

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

    // 3. Check available disk space
    if (game.archive_size) {
      // Parse size string like "150 MB" to bytes
      const requiredSpace = parseSizeToBytes(game.archive_size);

      if (requiredSpace > 0) {
        // We need 3x space: for archive + extracted files + final copy
        const neededSpace = requiredSpace * 3;

        const diskSpace = await checkDiskSpace(gamePath.path);

        if (diskSpace < neededSpace) {
          throw new Error(
            `Недостатньо місця на диску.\n\n` +
            `Необхідно: ${formatBytes(neededSpace)}\n` +
            `Доступно: ${formatBytes(diskSpace)}\n\n` +
            `Звільніть місце та спробуйте знову.`
          );
        }

        console.log(`[Installer] ✓ Disk space check passed (available: ${formatBytes(diskSpace)}, needed: ${formatBytes(neededSpace)})`);
      }
    }

    // 4. Download translation archive from Supabase Storage
    const tempDir = app.getPath('temp');
    const downloadDir = path.join(tempDir, 'little-bit-downloads');
    await mkdir(downloadDir, { recursive: true });

    const archivePath = path.join(downloadDir, `${game.id}_translation.zip`);

    // Get download URL from Supabase Storage
    const { getArchiveDownloadUrl } = await import('../lib/api');

    if (!game.archive_path) {
      throw new Error('Архів перекладу не знайдено');
    }

    const downloadUrl = getArchiveDownloadUrl(game.archive_path);

    console.log(`[Installer] Downloading from Supabase: ${downloadUrl}`);
    console.log(`[Installer] Saving to: ${archivePath}`);

    // Створити новий AbortController для цього завантаження
    currentDownloadAbortController = new AbortController();

    try {
      await downloadFile(
        downloadUrl,
        archivePath,
        (downloadProgress) => {
          onDownloadProgress?.(downloadProgress);
        },
        (status) => {
          onStatus?.(status);
        },
        3, // maxRetries
        currentDownloadAbortController.signal
      );
    } finally {
      // Очистити контроллер після завершення
      currentDownloadAbortController = null;
    }

    // Verify file hash if available
    if (game.archive_hash) {
      onStatus?.({ message: 'Перевірка цілісності файлу...' });
      console.log(`[Installer] Verifying file hash...`);
      const isValid = await verifyFileHash(archivePath, game.archive_hash);

      if (!isValid) {
        // Delete corrupted file
        if (fs.existsSync(archivePath)) {
          await unlink(archivePath);
        }
        throw new Error(
          'Файл перекладу пошкоджено або змінено.\n\n' +
          'Спробуйте завантажити ще раз або зверніться до підтримки.'
        );
      }
      console.log(`[Installer] ✓ File hash verified successfully`);
    }

    // 4. Extract archive
    onStatus?.({ message: 'Розпакування файлів...' });
    const extractDir = path.join(downloadDir, `${game.id}_extract`);
    await extractArchive(archivePath, extractDir);

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

    // 6. Backup original files and copy translation files
    const fullTargetPath = gamePath.path;
    console.log(`[Installer] Installing to: ${fullTargetPath}`);

    // Get list of all files that will be installed
    const installedFiles = await getAllFiles(extractDir);
    console.log(`[Installer] Will install ${installedFiles.length} files`);

    // Create backup of files that will be overwritten (if enabled)
    if (createBackup) {
      onStatus?.({ message: 'Створення резервної копії...' });
      await backupFiles(extractDir, fullTargetPath);
    } else {
      console.log('[Installer] Backup creation disabled by user');
    }

    onStatus?.({ message: 'Копіювання файлів перекладу...' });
    await copyDirectory(extractDir, fullTargetPath);

    // 7. Cleanup
    onStatus?.({ message: 'Очищення тимчасових файлів...' });
    await cleanup(archivePath, extractDir);

    // 8. Save installation info
    await saveInstallationInfo(gamePath.path, {
      gameId: game.id,
      version: game.version || '1.0.0',
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
      hasBackup: createBackup,
      installedFiles,
    });

    console.log(`[Installer] Translation for ${game.id} installed successfully at ${fullTargetPath}`);
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
 * Download file from URL with progress tracking and retry logic
 */
export async function downloadFile(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Перевірити чи не було скасовано
    if (signal?.aborted) {
      throw new Error('Завантаження скасовано');
    }

    try {
      if (attempt > 1) {
        console.log(`[Downloader] Retry attempt ${attempt}/${maxRetries}`);
        onStatus?.({ message: `Спроба ${attempt}/${maxRetries}... Перевірте підключення до Інтернету.` });
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 10000)));

        // Перевірити чи не було скасовано під час очікування
        if (signal?.aborted) {
          throw new Error('Завантаження скасовано');
        }
      } else {
        onStatus?.({ message: 'Завантаження перекладу...' });
      }

      await downloadFileAttempt(url, outputPath, onProgress, onStatus, signal);
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[Downloader] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // Показати користувачу що сталась помилка
      const isNetworkError = error instanceof Error && (
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('enotfound') ||
        error.message.toLowerCase().includes('etimedout') ||
        error.message.toLowerCase().includes('econnreset')
      );

      if (isNetworkError && attempt < maxRetries) {
        onStatus?.({ message: `Помилка мережі. Спроба ${attempt + 1}/${maxRetries}...` });
      }

      // Clean up partial download
      if (fs.existsSync(outputPath)) {
        try {
          await unlink(outputPath);
        } catch (cleanupError) {
          console.warn('[Downloader] Failed to clean up partial download:', cleanupError);
        }
      }

      // Don't retry on certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('404') || message.includes('not found') || message.includes('forbidden')) {
          throw error; // Don't retry on these errors
        }
        // Також не робити retry якщо завантаження скасовано
        if (message.includes('скасовано') || message.includes('aborted')) {
          throw error; // Don't retry on abort
        }
      }
    }
  }

  // All retries failed - clean up any partial file
  if (fs.existsSync(outputPath)) {
    try {
      await unlink(outputPath);
      console.log('[Downloader] Cleaned up failed download file');
    } catch (cleanupError) {
      console.warn('[Downloader] Failed to clean up after all retries:', cleanupError);
    }
  }

  throw new Error(
    `Не вдалося завантажити файл після ${maxRetries} спроб.\n\n` +
    `Остання помилка: ${lastError?.message || 'Невідома помилка'}\n\n` +
    'Перевірте підключення до Інтернету та спробуйте ще раз.'
  );
}

/**
 * Single download attempt
 */
async function downloadFileAttempt(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  signal?: AbortSignal
): Promise<void> {
  console.log(`[Downloader] Starting download: ${url}`);

  const writeStream = fs.createWriteStream(outputPath);
  const startTime = Date.now();
  let lastUpdateTime = Date.now();

  // Обробник скасування
  const abortHandler = () => {
    console.log('[Downloader] Download aborted by signal');
    writeStream.close();
  };

  signal?.addEventListener('abort', abortHandler);

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

    // Якщо вже скасовано - зупинити одразу
    if (signal?.aborted) {
      downloadStream.destroy();
      writeStream.close();
      const reason = signal?.reason || 'Завантаження скасовано';
      throw new Error(reason);
    }

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

      // Обробка скасування під час завантаження
      const onAbort = () => {
        downloadStream.destroy();
        writeStream.close();
        const reason = signal?.reason || 'Завантаження скасовано';
        reject(new Error(reason));
      };

      signal?.addEventListener('abort', onAbort);

      downloadStream.on('error', (error) => {
        signal?.removeEventListener('abort', onAbort);
        writeStream.close();
        reject(error);
      });

      writeStream.on('error', (error) => {
        signal?.removeEventListener('abort', onAbort);
        downloadStream.destroy();
        reject(error);
      });

      writeStream.on('finish', () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      });
    });

    console.log(`[Downloader] Download completed: ${outputPath}`);
  } catch (error) {
    console.error(`[Downloader] Download error:`, error);
    writeStream.close();

    // Provide more specific error messages and notify UI
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Перевірка на скасування
      if (message.includes('скасовано') || message.includes('aborted')) {
        onStatus?.({ message: `❌ ${error.message}` });
        throw error;
      }

      if (message.includes('enotfound') || message.includes('getaddrinfo')) {
        onStatus?.({ message: '❌ Відсутнє підключення до Інтернету' });
        throw new Error('Не вдалося підключитися до сервера. Перевірте підключення до Інтернету.');
      }

      if (message.includes('etimedout') || message.includes('timeout')) {
        onStatus?.({ message: '❌ Час очікування вичерпано. Перевірте підключення до Інтернету.' });
        throw new Error('Час очікування вичерпано. Перевірте підключення до Інтернету.');
      }

      if (message.includes('econnreset') || message.includes('socket hang up')) {
        onStatus?.({ message: '❌ З\'єднання розірвано. Перевірте підключення до Інтернету.' });
        throw new Error('З\'єднання розірвано. Перевірте підключення до Інтернету.');
      }

      if (message.includes('econnrefused')) {
        onStatus?.({ message: '❌ Сервер недоступний' });
        throw new Error('Сервер недоступний. Спробуйте пізніше.');
      }
    }

    onStatus?.({ message: '❌ Помилка завантаження. Перевірте підключення до Інтернету.' });
    throw new Error(`Помилка завантаження: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}

/**
 * Extract ZIP archive with UTF-8 support
 */
async function extractArchive(archivePath: string, extractPath: string): Promise<void> {
  try {
    await mkdir(extractPath, { recursive: true });

    const zip = new StreamZip.async({ file: archivePath });
    await zip.extract(null, extractPath);
    await zip.close();

    console.log(`Extracted archive to: ${extractPath}`);
  } catch (error) {
    throw new Error(
      `Помилка розпакування архіву: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Restore files from backup
 */
async function restoreBackup(backupDir: string, targetDir: string): Promise<void> {
  try {
    const entries = await readdir(backupDir, { withFileTypes: true });

    for (const entry of entries) {
      const backupPath = path.join(backupDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively restore subdirectory
        await restoreBackup(backupPath, targetPath);
      } else {
        // Restore file
        await fs.promises.copyFile(backupPath, targetPath);
        console.log(`[Restore] Restored: ${entry.name}`);
      }
    }

    console.log('[Restore] Restore completed');
  } catch (error) {
    console.error('[Restore] Error restoring backup:', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clean up empty directories recursively
 */
async function cleanupEmptyDirectories(dir: string, rootDir: string): Promise<void> {
  try {
    if (!fs.existsSync(dir)) return;

    const entries = await readdir(dir, { withFileTypes: true });

    // Recursively clean subdirectories first
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        await cleanupEmptyDirectories(subDir, rootDir);
      }
    }

    // Check if directory is now empty
    const remainingEntries = await readdir(dir);
    if (remainingEntries.length === 0 && dir !== rootDir) {
      await fs.promises.rmdir(dir);
      console.log(`[Cleanup] Deleted empty directory: ${path.relative(rootDir, dir)}`);
    }
  } catch (error) {
    console.warn(`[Cleanup] Failed to cleanup directory ${dir}:`, error);
  }
}

/**
 * Backup files that will be overwritten (only if backup doesn't exist already)
 */
async function backupFiles(sourceDir: string, targetDir: string): Promise<void> {
  try {
    const backupDir = path.join(targetDir, BACKUP_DIR_NAME);

    // If backup already exists, don't overwrite it (preserve original files)
    if (fs.existsSync(backupDir)) {
      console.log(`[Backup] Backup already exists, skipping to preserve original files: ${backupDir}`);
      return;
    }

    await mkdir(backupDir, { recursive: true });

    // Make backup directory hidden on Windows
    if (process.platform === 'win32') {
      try {
        await new Promise<void>((resolve) => {
          exec(`attrib +h "${backupDir}"`, (error) => {
            if (error) {
              console.warn('[Backup] Failed to hide backup directory:', error);
            }
            resolve(); // Don't fail backup if hiding fails
          });
        });
      } catch (error) {
        console.warn('[Backup] Failed to set hidden attribute:', error);
      }
    }

    // Read all files from source directory
    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      const backupPath = path.join(backupDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively backup subdirectory
        await backupFiles(sourcePath, targetPath);
      } else {
        // Check if file exists in target directory
        if (fs.existsSync(targetPath)) {
          // Backup the original file
          const backupFileDir = path.dirname(backupPath);
          await mkdir(backupFileDir, { recursive: true });
          await fs.promises.copyFile(targetPath, backupPath);
          console.log(`[Backup] Backed up: ${entry.name}`);
        }
      }
    }

    console.log(`[Backup] Backup completed to: ${backupDir}`);
  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    throw new Error(
      `Помилка створення резервної копії: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get list of all files in directory recursively (relative paths)
 */
async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively get files from subdirectory
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      // Store relative path
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
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

    if (platform === 'darwin' || platform === 'linux') {
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
 * Uninstall translation
 */
export async function uninstallTranslation(game: Game): Promise<void> {
  try {
    console.log(`[Installer] Uninstalling translation for: ${game.id}`);

    // Check if translation is installed
    const installInfo = await checkInstallation(game);

    if (!installInfo) {
      throw new Error('Переклад не встановлено');
    }

    const gamePath = installInfo.gamePath;
    const backupDir = path.join(gamePath, BACKUP_DIR_NAME);

    // Step 1: Delete all installed files (including new files that weren't backed up)
    if (installInfo.installedFiles && installInfo.installedFiles.length > 0) {
      console.log(`[Installer] Deleting ${installInfo.installedFiles.length} installed files...`);
      const directoriesDeleted = new Set<string>();

      for (const relativePath of installInfo.installedFiles) {
        const filePath = path.join(gamePath, relativePath);
        try {
          if (fs.existsSync(filePath)) {
            await unlink(filePath);
            console.log(`[Installer] Deleted: ${relativePath}`);

            // Try to delete empty parent directories
            let dirPath = path.dirname(filePath);
            while (dirPath !== gamePath && !directoriesDeleted.has(dirPath)) {
              try {
                const entries = await readdir(dirPath);
                if (entries.length === 0) {
                  await fs.promises.rmdir(dirPath);
                  directoriesDeleted.add(dirPath);
                  console.log(`[Installer] Deleted empty directory: ${path.relative(gamePath, dirPath)}`);
                  dirPath = path.dirname(dirPath);
                } else {
                  break; // Directory not empty, stop
                }
              } catch (error) {
                break; // Failed to delete or read, stop
              }
            }
          }
        } catch (error) {
          console.warn(`[Installer] Failed to delete file ${relativePath}:`, error);
        }
      }
    } else {
      console.warn('[Installer] No installed files list found, skipping file deletion');
    }

    // Step 2: Restore files from backup (original files that were overwritten)
    if (installInfo.hasBackup !== false && fs.existsSync(backupDir)) {
      console.log(`[Installer] Restoring files from backup: ${backupDir}`);
      await restoreBackup(backupDir, gamePath);

      // Delete backup directory
      await deleteDirectory(backupDir);
      console.log(`[Installer] Deleted backup directory: ${backupDir}`);
    } else {
      if (installInfo.hasBackup === false) {
        console.warn('[Installer] Backup was disabled during installation, skipping file restoration');
      } else {
        console.warn('[Installer] No backup found, skipping file restoration');
      }
    }

    // Step 3: Clean up empty directories (including .littlebit-backup if empty)
    console.log('[Installer] Cleaning up empty directories...');
    await cleanupEmptyDirectories(gamePath, gamePath);

    // Delete installation info file
    const infoPath = path.join(gamePath, INSTALLATION_INFO_FILE);
    if (fs.existsSync(infoPath)) {
      await unlink(infoPath);
      console.log(`[Installer] Deleted installation info file: ${infoPath}`);
    }

    // Delete cached installation info
    try {
      const userDataPath = app.getPath('userData');
      const installInfoDir = path.join(userDataPath, 'installation-cache');
      const cacheInfoPath = path.join(installInfoDir, `${game.id}.json`);
      if (fs.existsSync(cacheInfoPath)) {
        await unlink(cacheInfoPath);
        console.log(`[Installer] Deleted cached installation info: ${cacheInfoPath}`);
      }
    } catch (error) {
      console.warn('[Installer] Failed to delete cached installation info:', error);
    }

    console.log(`[Installer] Translation for ${game.id} uninstalled successfully`);
  } catch (error) {
    console.error('[Installer] Uninstall error:', error);
    throw new Error(
      `Помилка видалення перекладу: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Check if translation is installed and get installation info
 */
export async function checkInstallation(game: Game): Promise<InstallationInfo | null> {
  try {
    console.log(`[Installer] Checking installation for: ${game.id}`);

    // First, try to find installation info from previous installations
    // This helps when game was installed via manual folder selection
    const previousInstallInfoPath = getPreviousInstallPath(game.id);
    if (previousInstallInfoPath && fs.existsSync(previousInstallInfoPath)) {
      try {
        const infoContent = await fs.promises.readFile(previousInstallInfoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        // Verify the path still exists AND the installation info file exists in game folder
        const gameInfoPath = path.join(info.gamePath, INSTALLATION_INFO_FILE);
        if (fs.existsSync(info.gamePath) && fs.existsSync(gameInfoPath)) {
          console.log(
            `[Installer] Found previous installation at custom path: ${info.gamePath}`
          );
          return info;
        } else {
          // Cache is stale - game folder or translation was removed
          console.log('[Installer] Cache is stale, removing cached installation info');
          try {
            await unlink(previousInstallInfoPath);
          } catch {
            // Ignore deletion errors
          }
        }
      } catch (error) {
        console.warn('[Installer] Failed to read previous installation info:', error);
      }
    }

    // Detect game installation path from standard locations
    const gamePath = getFirstAvailableGamePath(game.install_paths || []);

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

/**
 * Invalidate the installed game IDs cache
 */
export function invalidateInstalledGameIdsCache(): void {
  console.log('[Installer] Invalidating installed game IDs cache');
  installedGameIdsCache = null;
}

/**
 * Get all installed game IDs from installation cache (with caching)
 */
export async function getAllInstalledGameIds(): Promise<string[]> {
  // Return cached value if available
  if (installedGameIdsCache !== null) {
    console.log(`[Installer] Using cached installed games (${installedGameIdsCache.length} games)`);
    return installedGameIdsCache;
  }

  try {
    const userDataPath = app.getPath('userData');
    const installInfoDir = path.join(userDataPath, 'installation-cache');

    // Check if directory exists
    if (!fs.existsSync(installInfoDir)) {
      installedGameIdsCache = [];
      return [];
    }

    // Read all files in the directory
    const files = await readdir(installInfoDir);

    // Extract game IDs from filenames (remove .json extension)
    const gameIds = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    console.log(`[Installer] Found ${gameIds.length} installed games:`, gameIds);

    // Cache the result
    installedGameIdsCache = gameIds;
    return gameIds;
  } catch (error) {
    console.error('[Installer] Error getting installed game IDs:', error);
    installedGameIdsCache = [];
    return [];
  }
}

// Cache for installed game IDs
let installedGameIdsCache: string[] | null = null;

/**
 * Verify file hash (SHA-256)
 */
async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const hash = createHash('sha256');
    hash.update(fileBuffer);
    const actualHash = hash.digest('hex');

    console.log(`[Hash] Expected: ${expectedHash}`);
    console.log(`[Hash] Actual:   ${actualHash}`);

    return actualHash === expectedHash;
  } catch (error) {
    console.error('[Hash] Error verifying file hash:', error);
    return false;
  }
}

/**
 * Parse size string like "150.00 MB" to bytes (reverse of formatBytes)
 */
function parseSizeToBytes(sizeString: string): number {
  const match = sizeString.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 0);
}

/**
 * Check available disk space
 */
async function checkDiskSpace(targetPath: string): Promise<number> {
  try {
    const stats = await fs.promises.statfs(targetPath);
    // Available space = block size * available blocks
    return stats.bavail * stats.bsize;
  } catch (error) {
    console.error('[DiskSpace] Error checking disk space:', error);
    // Return a large number to not block installation if we can't check
    return Number.MAX_SAFE_INTEGER;
  }
}
