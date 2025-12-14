import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec, execSync } from 'child_process';
import { createHash } from 'crypto';
import got from 'got';
import { extractFull } from 'node-7z';
import { path7z as originalPath7z, path7zzs } from '7zip-bin-full';

// Fix for ASAR: replace .asar with .asar.unpacked for spawnable binaries
const bundled7z = originalPath7z.replace('app.asar', 'app.asar.unpacked');
const bundled7zzs = path7zzs.replace('app.asar', 'app.asar.unpacked');

/**
 * Check if system 7z is available (for Linux/Steam Deck compatibility)
 */
function getSystem7zPath(): string | null {
  if (process.platform !== 'linux') return null;

  try {
    // Try common 7z command names
    for (const cmd of ['7zz', '7z', '7za']) {
      try {
        const result = execSync(`which ${cmd}`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
        if (result) {
          console.log(`[7z] Found system 7z: ${result}`);
          return result;
        }
      } catch {
        // Command not found, try next
      }
    }
  } catch (error) {
    console.log('[7z] No system 7z found');
  }
  return null;
}

/**
 * Get the best available 7z binary path
 * Priority: system 7z > static 7zzs > bundled 7zz
 */
function get7zPath(): string {
  // On Linux, prefer system 7z for better compatibility (especially Steam Deck)
  if (process.platform === 'linux') {
    const system7z = getSystem7zPath();
    if (system7z) {
      return system7z;
    }

    // Fallback to static binary (no dynamic library dependencies)
    if (fs.existsSync(bundled7zzs)) {
      console.log(`[7z] Using static bundled 7zzs: ${bundled7zzs}`);
      return bundled7zzs;
    }
  }

  // Default: use bundled 7zz
  console.log(`[7z] Using bundled 7z: ${bundled7z}`);
  return bundled7z;
}

const path7z = get7zPath();
import { getFirstAvailableGamePath, getSteamPath } from './game-detector';
import type {
  InstallationInfo,
  Game,
  DownloadProgress,
  InstallationStatus,
  InstallOptions,
} from '../shared/types';
import { formatBytes } from '../shared/formatters';
import { isWindows, isLinux, getPlatform } from './utils/platform';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

const INSTALLATION_INFO_FILE = '.littlebit-translation.json';
const BACKUP_DIR_NAME = '.littlebit-backup';
const BACKUP_SUFFIX = '_backup'; // file.upk -> file.upk_backup

/**
 * Помилка яка потребує ручного вибору папки
 */
export class ManualSelectionError extends Error {
  public readonly needsManualSelection = true;

  constructor(message: string) {
    super(message);
    this.name = 'ManualSelectionError';
  }
}

/**
 * Помилка rate-limit для завантажень
 */
export class RateLimitError extends Error {
  public readonly isRateLimit = true;
  public readonly nextAvailableAt: string | null;
  public readonly downloadsToday: number;
  public readonly maxAllowed: number;

  constructor(
    nextAvailableAt: string | null,
    downloadsToday: number,
    maxAllowed: number
  ) {
    const nextTime = nextAvailableAt ? new Date(nextAvailableAt) : null;
    const timeStr = nextTime
      ? nextTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
      : 'невідомо';

    super(
      `Перевищено ліміт завантажень.\n\n` +
        `Ви вже завантажили цю гру ${downloadsToday} раз(и) за останні 24 години.\n` +
        `Максимум дозволено: ${maxAllowed} завантаження на добу для великих ігор.\n\n` +
        `Спробуйте знову після ${timeStr}.`
    );
    this.name = 'RateLimitError';
    this.nextAvailableAt = nextAvailableAt;
    this.downloadsToday = downloadsToday;
    this.maxAllowed = maxAllowed;
  }
}

// Глобальний AbortController для скасування поточного завантаження
let currentDownloadAbortController: AbortController | null = null;

/**
 * Скасувати поточне завантаження
 */
export function abortCurrentDownload(): void {
  if (currentDownloadAbortController) {
    console.log('[Installer] Aborting current download due to connection loss');
    currentDownloadAbortController.abort(
      'Завантаження скасовано через відсутність підключення до Інтернету'
    );
    currentDownloadAbortController = null;
  }
}

/**
 * Main installation function
 */
export async function installTranslation(
  game: Game,
  platform: string,
  options: InstallOptions,
  customGamePath?: string,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  const { createBackup, installText, installVoice, installAchievements } = options;

  try {
    console.log(`[Installer] ========== INSTALLATION START ==========`);
    console.log(`[Installer] Installing translation for: ${game.name} (${game.id})`);
    console.log(`[Installer] Options:`, JSON.stringify(options));
    console.log(`[Installer] Game voice_archive_path: ${game.voice_archive_path}`);
    console.log(
      `[Installer] Game achievements_archive_path: ${game.achievements_archive_path}`
    );
    console.log(`[Installer] Game archive_path: ${game.archive_path}`);
    console.log(
      `[Installer] Install paths config:`,
      JSON.stringify(game.install_paths, null, 2)
    );
    console.log(`[Installer] Requested platform: ${platform}`);

    // 2. Detect game installation path
    const gamePath = customGamePath
      ? { platform, path: customGamePath, exists: true }
      : getFirstAvailableGamePath(game.install_paths || []);

    if (!gamePath || !gamePath.exists || !gamePath.path) {
      console.error(`[Installer] Game not found. Searched paths:`, game.install_paths);
      const platformPath = (game.install_paths || []).find(
        (p) => p.type === platform
      )?.path;

      // Special error to indicate manual folder selection needed
      throw new ManualSelectionError(
        `Гру не знайдено автоматично.\n\n` +
          `Шукали папку: ${platformPath || 'не вказано'}\n\n` +
          `Виберіть папку з грою вручну.`
      );
    }

    console.log(`[Installer] ✓ Game found at: ${gamePath.path} (${gamePath.platform})`);

    // 3. Check available disk space (for text + voice + achievements if installing)
    let requiredSpace = 0;
    if (installText && game.archive_size) {
      requiredSpace += parseSizeToBytes(game.archive_size);
    }
    if (installVoice && game.voice_archive_size) {
      requiredSpace += parseSizeToBytes(game.voice_archive_size);
    }
    if (installAchievements && game.achievements_archive_size) {
      requiredSpace += parseSizeToBytes(game.achievements_archive_size);
    }

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

      console.log(
        `[Installer] ✓ Disk space check passed (available: ${formatBytes(diskSpace)}, needed: ${formatBytes(neededSpace)})`
      );
    }

    // 4. Download translation archive from Supabase Storage
    const tempDir = app.getPath('temp');
    const downloadDir = path.join(tempDir, 'little-bit-downloads');
    await mkdir(downloadDir, { recursive: true });

    // Get signed download URL from Edge Function (includes rate-limit check)
    const { getSignedDownloadUrl } = await import('./tracking');

    // 4.1 Download text archive if requested
    let textFiles: string[] = [];
    const extractDir = path.join(downloadDir, `${game.id}_extract`);

    if (installText) {
      const archivePath = path.join(downloadDir, `${game.id}_translation.zip`);

      if (!game.archive_path) {
        throw new Error('Архів українізатора не знайдено');
      }

      onStatus?.({ message: 'Отримання посилання для завантаження...' });
      const urlResult = await getSignedDownloadUrl(game.id, game.archive_path, 'text');

      if (!urlResult.success) {
        if (urlResult.error === 'rate_limit_exceeded' && 'nextAvailableAt' in urlResult) {
          throw new RateLimitError(
            urlResult.nextAvailableAt,
            urlResult.downloadsToday,
            urlResult.maxAllowed
          );
        }
        throw new Error(
          `Не вдалося отримати посилання для завантаження: ${urlResult.error}`
        );
      }

      const downloadUrl = urlResult.downloadUrl;

      console.log(`[Installer] Downloading text archive from Supabase (signed URL)`);
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
            'Файл українізатора пошкоджено або змінено.\n\n' +
              'Спробуйте завантажити ще раз або зверніться до підтримки.'
          );
        }
        console.log(`[Installer] ✓ File hash verified successfully`);
      }

      // Extract text archive
      await extractArchive(archivePath, extractDir, onStatus);

      // Get list of text archive files
      textFiles = await getAllFiles(extractDir);
      console.log(`[Installer] Text archive has ${textFiles.length} files`);
    }

    // 4.2 Download and extract voice archive if requested
    let voiceFiles: string[] = [];
    console.log(
      `[Installer] Voice install requested: ${installVoice}, voice_archive_path: ${game.voice_archive_path}`
    );
    if (installVoice && game.voice_archive_path) {
      const voiceArchivePath = path.join(downloadDir, `${game.id}_voice.zip`);

      onStatus?.({ message: 'Отримання посилання для озвучки...' });
      const voiceUrlResult = await getSignedDownloadUrl(
        game.id,
        game.voice_archive_path,
        'voice'
      );

      if (!voiceUrlResult.success) {
        throw new Error(
          `Не вдалося отримати посилання для озвучки: ${voiceUrlResult.error}`
        );
      }

      const voiceDownloadUrl = voiceUrlResult.downloadUrl;

      console.log(`[Installer] Downloading voice archive from Supabase (signed URL)`);
      onStatus?.({ message: 'Завантаження озвучки...' });

      // Create new AbortController for voice download
      currentDownloadAbortController = new AbortController();

      try {
        await downloadFile(
          voiceDownloadUrl,
          voiceArchivePath,
          (downloadProgress) => {
            onDownloadProgress?.(downloadProgress);
          },
          (status) => {
            onStatus?.(status);
          },
          3,
          currentDownloadAbortController.signal
        );
      } finally {
        currentDownloadAbortController = null;
      }

      // Verify voice file hash if available
      if (game.voice_archive_hash) {
        onStatus?.({ message: 'Перевірка цілісності озвучки...' });
        console.log(`[Installer] Verifying voice file hash...`);
        const isValid = await verifyFileHash(voiceArchivePath, game.voice_archive_hash);

        if (!isValid) {
          if (fs.existsSync(voiceArchivePath)) {
            await unlink(voiceArchivePath);
          }
          throw new Error(
            'Файл озвучки пошкоджено або змінено.\n\n' +
              'Спробуйте завантажити ще раз або зверніться до підтримки.'
          );
        }
        console.log(`[Installer] ✓ Voice file hash verified successfully`);
      }

      // Extract voice archive to the same directory
      const voiceExtractDir = path.join(downloadDir, `${game.id}_voice_extract`);
      await extractArchive(voiceArchivePath, voiceExtractDir, (status) => {
        onStatus?.({
          message:
            `Розпакування озвучки... ${status.progress ? status.progress + '%' : ''}`.trim(),
        });
      });

      // Get list of voice files
      voiceFiles = await getAllFiles(voiceExtractDir);
      console.log(`[Installer] Voice archive has ${voiceFiles.length} files`);

      // Copy voice files to main extract directory (they will be installed together)
      await copyDirectory(voiceExtractDir, extractDir);
    }

    // 4.6 Download and extract achievements archive if requested (Steam only)
    let achievementsFiles: string[] = [];
    let achievementsInstallPath: string | null = null;
    console.log(
      `[Installer] Achievements install requested: ${installAchievements}, achievements_archive_path: ${game.achievements_archive_path}`
    );
    if (installAchievements && game.achievements_archive_path && platform === 'steam') {
      const achievementsArchivePath = path.join(
        downloadDir,
        `${game.id}_achievements.zip`
      );

      onStatus?.({ message: 'Отримання посилання для ачівок...' });
      const achievementsUrlResult = await getSignedDownloadUrl(
        game.id,
        game.achievements_archive_path,
        'achievements'
      );

      if (!achievementsUrlResult.success) {
        throw new Error(
          `Не вдалося отримати посилання для ачівок: ${achievementsUrlResult.error}`
        );
      }

      const achievementsDownloadUrl = achievementsUrlResult.downloadUrl;

      console.log(
        `[Installer] Downloading achievements archive from Supabase (signed URL)`
      );
      onStatus?.({ message: 'Завантаження перекладу ачівок...' });

      // Create new AbortController for achievements download
      currentDownloadAbortController = new AbortController();

      try {
        await downloadFile(
          achievementsDownloadUrl,
          achievementsArchivePath,
          (downloadProgress) => {
            onDownloadProgress?.(downloadProgress);
          },
          (status) => {
            onStatus?.(status);
          },
          3,
          currentDownloadAbortController.signal
        );
      } finally {
        currentDownloadAbortController = null;
      }

      // Verify achievements file hash if available
      if (game.achievements_archive_hash) {
        onStatus?.({ message: 'Перевірка цілісності ачівок...' });
        console.log(`[Installer] Verifying achievements file hash...`);
        const isValid = await verifyFileHash(
          achievementsArchivePath,
          game.achievements_archive_hash
        );

        if (!isValid) {
          if (fs.existsSync(achievementsArchivePath)) {
            await unlink(achievementsArchivePath);
          }
          throw new Error(
            'Файл перекладу ачівок пошкоджено або змінено.\n\n' +
              'Спробуйте завантажити ще раз або зверніться до підтримки.'
          );
        }
        console.log(`[Installer] ✓ Achievements file hash verified successfully`);
      }

      // Extract achievements archive to temp directory
      const achievementsExtractDir = path.join(
        downloadDir,
        `${game.id}_achievements_extract`
      );
      await extractArchive(achievementsArchivePath, achievementsExtractDir, (status) => {
        onStatus?.({
          message:
            `Розпакування ачівок... ${status.progress ? status.progress + '%' : ''}`.trim(),
        });
      });

      // Get list of achievements files
      achievementsFiles = await getAllFiles(achievementsExtractDir);
      console.log(
        `[Installer] Achievements archive has ${achievementsFiles.length} files`
      );

      // Determine Steam path for achievements (Steam/appcache/stats)
      // Always uses main Steam installation, not the game's library folder
      achievementsInstallPath = await getSteamAchievementsPath();

      if (achievementsInstallPath) {
        console.log(`[Installer] Installing achievements to: ${achievementsInstallPath}`);
        onStatus?.({ message: 'Копіювання перекладу ачівок...' });
        await mkdir(achievementsInstallPath, { recursive: true });

        // Create backup of original achievements files before overwriting
        if (createBackup) {
          await backupFiles(achievementsExtractDir, achievementsInstallPath);
        }

        await copyDirectory(achievementsExtractDir, achievementsInstallPath);
      } else {
        console.warn(
          '[Installer] Could not determine Steam achievements path, skipping achievements installation'
        );
      }
    }

    // 5. Check for executable installer file and run if present
    const installerFileName = getInstallerFileName(game);
    const isExeInstaller = hasExecutableInstaller(game);

    if (installerFileName && isExeInstaller) {
      // Game has its own executable installer - let it handle the installation
      // We don't copy files or create backups since the installer manages everything
      console.log(`[Installer] Found executable installer: ${installerFileName}`);
      console.log(
        `[Installer] Skipping backup and file copy - installer will handle installation`
      );

      try {
        await runInstaller(extractDir, installerFileName);
        console.log(
          `[Installer] Installer launched successfully. User needs to complete installation.`
        );
      } catch (error) {
        console.error('[Installer] Failed to launch installer:', error);
        throw new Error('Не вдалося запустити інсталятор українізатора');
      }

      // Cleanup temp files
      onStatus?.({ message: 'Очищення тимчасових файлів...' });
      await cleanupDownloadDir(downloadDir);

      // Save minimal installation info (no file tracking since installer handles it)
      const installationInfo: InstallationInfo = {
        gameId: game.id,
        version: game.version || '1.0.0',
        installedAt: new Date().toISOString(),
        gamePath: gamePath.path,
        hasBackup: false, // Installer manages its own backups
        isCustomPath: !!customGamePath, // Track if installed via manual folder selection
        installedFiles: [], // Installer manages files
        components: {
          text: {
            installed: true,
            files: [], // Unknown - installer handles it
          },
        },
      };
      await saveInstallationInfo(gamePath.path, installationInfo);

      console.log(
        `[Installer] Translation installer launched for ${game.id}. User must complete installation manually.`
      );
      return;
    }

    // 6. Backup original files and copy translation files (only for non-installer translations)
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

    onStatus?.({ message: 'Копіювання файлів українізатора...' });
    await copyDirectory(extractDir, fullTargetPath);

    // 7. Cleanup
    onStatus?.({ message: 'Очищення тимчасових файлів...' });
    await cleanupDownloadDir(downloadDir);

    // 8. Save installation info with components structure
    const installationInfo: InstallationInfo = {
      gameId: game.id,
      version: game.version || '1.0.0',
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
      hasBackup: createBackup,
      isCustomPath: !!customGamePath, // Track if installed via manual folder selection
      installedFiles, // Legacy field for backward compatibility
      components: {
        text: {
          installed: true,
          files: textFiles,
        },
        ...(installVoice && voiceFiles.length > 0
          ? {
              voice: {
                installed: true,
                files: voiceFiles,
              },
            }
          : {}),
        ...(installAchievements && achievementsFiles.length > 0 && achievementsInstallPath
          ? {
              achievements: {
                installed: true,
                files: achievementsFiles.map((f) =>
                  path.join(achievementsInstallPath!, f)
                ),
              },
            }
          : {}),
      },
    };
    await saveInstallationInfo(gamePath.path, installationInfo);

    console.log(
      `[Installer] Translation for ${game.id} installed successfully at ${fullTargetPath}`
    );
  } catch (error) {
    console.error('[Installer] Installation error:', error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      // Check if it's already a user-friendly error (e.g., from needsManualSelection)
      if (error instanceof ManualSelectionError) {
        throw error;
      }

      // Network errors
      if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error(
          'Не вдалося завантажити українізатор.\n\nПеревірте підключення до Інтернету та спробуйте ще раз.'
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
          'Файл або папку не знайдено.\n\nПереконайтеся, що гра встановлена та шлях вказано правильно.'
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

/**
 * Download file from URL with progress tracking and retry logic
 */
async function downloadFile(
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
        onStatus?.({
          message: `Спроба ${attempt}/${maxRetries}... Перевірте підключення до Інтернету.`,
        });
        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 10000))
        );

        // Перевірити чи не було скасовано під час очікування
        if (signal?.aborted) {
          throw new Error('Завантаження скасовано');
        }
      } else {
        onStatus?.({ message: 'Завантаження українізатора...' });
      }

      await downloadFileAttempt(url, outputPath, onProgress, onStatus, signal);
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(
        `[Downloader] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      // Показати користувачу що сталась помилка
      const isNetworkError =
        error instanceof Error &&
        (error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('enotfound') ||
          error.message.toLowerCase().includes('etimedout') ||
          error.message.toLowerCase().includes('econnreset'));

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
        if (
          message.includes('404') ||
          message.includes('not found') ||
          message.includes('forbidden')
        ) {
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
        throw new Error(
          'Не вдалося підключитися до сервера. Перевірте підключення до Інтернету.'
        );
      }

      if (message.includes('etimedout') || message.includes('timeout')) {
        onStatus?.({
          message: '❌ Час очікування вичерпано. Перевірте підключення до Інтернету.',
        });
        throw new Error('Час очікування вичерпано. Перевірте підключення до Інтернету.');
      }

      if (message.includes('econnreset') || message.includes('socket hang up')) {
        onStatus?.({
          message: "❌ З'єднання розірвано. Перевірте підключення до Інтернету.",
        });
        throw new Error("З'єднання розірвано. Перевірте підключення до Інтернету.");
      }

      if (message.includes('econnrefused')) {
        onStatus?.({ message: '❌ Сервер недоступний' });
        throw new Error('Сервер недоступний. Спробуйте пізніше.');
      }
    }

    onStatus?.({
      message: '❌ Помилка завантаження. Перевірте підключення до Інтернету.',
    });
    throw new Error(
      `Помилка завантаження: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  } finally {
    signal?.removeEventListener('abort', abortHandler);
  }
}

/**
 * Extract ZIP archive with support for all compression methods and UTF-8/Cyrillic filenames
 * Uses 7-Zip which supports LZMA, Deflate64, and all other compression methods
 */
async function extractArchive(
  archivePath: string,
  extractPath: string,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  await mkdir(extractPath, { recursive: true });

  // Check if file exists and get its size
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Archive file not found: ${archivePath}`);
  }

  const stats = fs.statSync(archivePath);
  console.log(`[Installer] Extracting archive: ${archivePath}`);
  console.log(`[Installer] Target directory: ${extractPath}`);
  console.log(`[Installer] Archive size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  return new Promise<void>((resolve, reject) => {
    // Use 7-Zip for extraction (supports all compression methods including LZMA)
    const stream = extractFull(archivePath, extractPath, {
      $bin: path7z,
      $progress: true,
    });

    stream.on('data', (data: { file?: string }) => {
      console.log(`[Installer] Extracted: ${data.file || 'file'}`);
    });

    stream.on('progress', (progress: { percent?: number; fileCount?: number }) => {
      if (progress.percent !== undefined) {
        const percent = Math.round(progress.percent);
        console.log(`[Installer] Extraction progress: ${percent}%`);
        onStatus?.({
          message: `Розпакування файлів... ${percent}%`,
          progress: percent,
        });
      }
    });

    stream.on('end', () => {
      console.log(`[Installer] Extracted archive to: ${extractPath}`);
      onStatus?.({ message: 'Розпакування завершено' });
      resolve();
    });

    stream.on('error', (err: Error) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Installer] extractArchive failed:`, {
        message: errorMessage,
        archivePath,
      });
      reject(new Error(`Помилка розпакування архіву: ${errorMessage}`));
    });
  });
}

/**
 * Restore files from backup (legacy format - .littlebit-backup directory)
 */
async function restoreBackupLegacy(backupDir: string, targetDir: string): Promise<void> {
  try {
    const entries = await readdir(backupDir, { withFileTypes: true });

    for (const entry of entries) {
      const backupPath = path.join(backupDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively restore subdirectory
        await restoreBackupLegacy(backupPath, targetPath);
      } else {
        // Restore file
        await fs.promises.copyFile(backupPath, targetPath);
        console.log(`[Restore] Restored (legacy): ${entry.name}`);
      }
    }

    console.log('[Restore] Legacy restore completed');
  } catch (error) {
    console.error('[Restore] Error restoring backup:', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Restore files from new backup format (file.upk_backup -> file.upk)
 * Searches for *_backup files and restores them
 */
async function restoreBackupNew(
  targetDir: string,
  installedFiles: string[]
): Promise<void> {
  try {
    let restoredCount = 0;

    for (const relativePath of installedFiles) {
      const targetPath = path.join(targetDir, relativePath);
      const backupPath = targetPath + BACKUP_SUFFIX;

      if (fs.existsSync(backupPath)) {
        // Restore the original file from backup
        await fs.promises.copyFile(backupPath, targetPath);
        // Delete the backup file
        await unlink(backupPath);
        console.log(
          `[Restore] Restored: ${path.basename(targetPath)} from ${path.basename(backupPath)}`
        );
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(
        `[Restore] New format restore completed: ${restoredCount} files restored`
      );
    }
  } catch (error) {
    console.error('[Restore] Error restoring backup (new format):', error);
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
 * Backup files that will be overwritten using new format (file.upk -> file.upk_backup)
 * Files are backed up in place, not in a separate directory
 * This prevents games from detecting backup files by extension scanning
 */
async function backupFiles(sourceDir: string, targetDir: string): Promise<void> {
  try {
    // Read all files from source directory (files that will be installed)
    const entries = await readdir(sourceDir, { withFileTypes: true });
    let backedUpCount = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively backup subdirectory
        await backupFiles(sourcePath, targetPath);
      } else {
        // Check if file exists in target directory
        if (fs.existsSync(targetPath)) {
          const backupPath = targetPath + BACKUP_SUFFIX; // file.upk -> file.upk_backup

          // Only create backup if it doesn't exist (preserve original files)
          if (!fs.existsSync(backupPath)) {
            await fs.promises.copyFile(targetPath, backupPath);
            console.log(
              `[Backup] Backed up: ${entry.name} -> ${entry.name}${BACKUP_SUFFIX}`
            );
            backedUpCount++;
          } else {
            console.log(
              `[Backup] Backup already exists, skipping: ${entry.name}${BACKUP_SUFFIX}`
            );
          }
        }
      }
    }

    if (backedUpCount > 0) {
      console.log(`[Backup] Backup completed: ${backedUpCount} files backed up in place`);
    }
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
async function cleanupDownloadDir(downloadDir: string): Promise<void> {
  try {
    // Delete entire download directory with all archives and extracted files
    if (fs.existsSync(downloadDir)) {
      await deleteDirectory(downloadDir);
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
 * Get installer file name based on platform
 */
function getInstallerFileName(game: Game): string | null {
  const isWindowsOS = isWindows();
  const isLinuxOS = isLinux();

  if (isWindowsOS && game.installation_file_windows_path) {
    return game.installation_file_windows_path;
  }

  if (isLinuxOS && game.installation_file_linux_path) {
    return game.installation_file_linux_path;
  }

  return null;
}

/**
 * Check if game has an executable installer (not just any installation file)
 */
function hasExecutableInstaller(game: Game): boolean {
  const installerFileName = getInstallerFileName(game);
  if (!installerFileName) return false;
  return isExecutableInstaller(installerFileName);
}

/**
 * Run installer file from extracted archive
 */
async function runInstaller(
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
      throw new Error('Українізатор не встановлено');
    }

    const gamePath = installInfo.gamePath;
    const backupDir = path.join(gamePath, BACKUP_DIR_NAME);

    // Step 1: Collect all files to delete (from components or legacy installedFiles)
    let allFilesToDelete: string[] = [];

    if (installInfo.components) {
      // New format: use components structure
      if (installInfo.components.text?.installed) {
        allFilesToDelete.push(...installInfo.components.text.files);
        console.log(
          `[Installer] Text component: ${installInfo.components.text.files.length} files`
        );
      }
      if (installInfo.components.voice?.installed) {
        allFilesToDelete.push(...installInfo.components.voice.files);
        console.log(
          `[Installer] Voice component: ${installInfo.components.voice.files.length} files`
        );
      }
      // Delete/restore achievements files (they are stored with full paths)
      if (installInfo.components.achievements?.installed) {
        console.log(
          `[Installer] Achievements component: ${installInfo.components.achievements.files.length} files`
        );
        for (const achievementFile of installInfo.components.achievements.files) {
          const backupPath = achievementFile + BACKUP_SUFFIX;
          try {
            // Check if backup exists - restore it
            if (fs.existsSync(backupPath)) {
              if (fs.existsSync(achievementFile)) {
                await unlink(achievementFile);
              }
              await fs.promises.rename(backupPath, achievementFile);
              console.log(
                `[Installer] Restored achievement file from backup: ${achievementFile}`
              );
            } else if (fs.existsSync(achievementFile)) {
              // No backup - just delete
              await unlink(achievementFile);
              console.log(`[Installer] Deleted achievement file: ${achievementFile}`);
            }
          } catch (error) {
            console.warn(
              `[Installer] Failed to restore/delete achievement file ${achievementFile}:`,
              error
            );
          }
        }
      }
    } else if (installInfo.installedFiles && installInfo.installedFiles.length > 0) {
      // Legacy format: use installedFiles
      allFilesToDelete = installInfo.installedFiles;
      console.log(
        `[Installer] Legacy format: ${installInfo.installedFiles.length} files`
      );
    }

    // Delete all files
    if (allFilesToDelete.length > 0) {
      console.log(`[Installer] Deleting ${allFilesToDelete.length} installed files...`);
      const directoriesDeleted = new Set<string>();

      for (const relativePath of allFilesToDelete) {
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
                  console.log(
                    `[Installer] Deleted empty directory: ${path.relative(gamePath, dirPath)}`
                  );
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
    // Support both legacy format (.littlebit-backup directory) and new format (*_backup files)
    if (installInfo.hasBackup !== false) {
      const hasLegacyBackup = fs.existsSync(backupDir);

      if (hasLegacyBackup) {
        // Legacy format: restore from .littlebit-backup directory
        console.log(`[Installer] Restoring files from legacy backup: ${backupDir}`);
        await restoreBackupLegacy(backupDir, gamePath);

        // Delete backup directory
        await deleteDirectory(backupDir);
        console.log(`[Installer] Deleted backup directory: ${backupDir}`);
      } else {
        // New format: restore from *_backup files
        console.log(
          `[Installer] Restoring files from new backup format (${BACKUP_SUFFIX} files)`
        );
        await restoreBackupNew(gamePath, allFilesToDelete);
      }
    } else {
      console.warn(
        '[Installer] Backup was disabled during installation, skipping file restoration'
      );
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
      `Помилка видалення українізатора: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Remove specific components (voice, achievements) without full uninstall
 * Used when user unchecks a component during reinstallation
 * Restores backups if they exist
 */
export async function removeComponents(
  game: Game,
  componentsToRemove: { voice?: boolean; achievements?: boolean }
): Promise<void> {
  try {
    console.log(`[Installer] Removing components for: ${game.id}`, componentsToRemove);

    const installInfo = await checkInstallation(game);
    if (!installInfo) {
      throw new Error('Українізатор не встановлено');
    }

    const gamePath = installInfo.gamePath;

    // Remove voice component
    if (componentsToRemove.voice && installInfo.components?.voice?.installed) {
      console.log(
        `[Installer] Removing voice component: ${installInfo.components.voice.files.length} files`
      );

      for (const relativePath of installInfo.components.voice.files) {
        const filePath = path.join(gamePath, relativePath);
        const backupPath = filePath + BACKUP_SUFFIX;

        try {
          // Check if backup exists - restore it
          if (fs.existsSync(backupPath)) {
            // Delete the translation file first
            if (fs.existsSync(filePath)) {
              await unlink(filePath);
            }
            // Restore from backup
            await fs.promises.rename(backupPath, filePath);
            console.log(`[Installer] Restored voice file from backup: ${relativePath}`);
          } else if (fs.existsSync(filePath)) {
            // No backup - just delete (file was added, not replaced)
            await unlink(filePath);
            console.log(`[Installer] Deleted voice file (no backup): ${relativePath}`);
          }
        } catch (error) {
          console.warn(
            `[Installer] Failed to restore/delete voice file ${relativePath}:`,
            error
          );
        }
      }

      // Update installation info - remove voice component
      installInfo.components.voice = { installed: false, files: [] };
    }

    // Remove achievements component
    if (
      componentsToRemove.achievements &&
      installInfo.components?.achievements?.installed
    ) {
      console.log(
        `[Installer] Removing achievements component: ${installInfo.components.achievements.files.length} files`
      );

      // Achievements files are stored with full paths
      for (const achievementFile of installInfo.components.achievements.files) {
        const backupPath = achievementFile + BACKUP_SUFFIX;

        try {
          // Check if backup exists - restore it
          if (fs.existsSync(backupPath)) {
            // Delete the translation file first
            if (fs.existsSync(achievementFile)) {
              await unlink(achievementFile);
            }
            // Restore from backup
            await fs.promises.rename(backupPath, achievementFile);
            console.log(
              `[Installer] Restored achievement file from backup: ${achievementFile}`
            );
          } else if (fs.existsSync(achievementFile)) {
            // No backup - just delete (file was added, not replaced)
            await unlink(achievementFile);
            console.log(
              `[Installer] Deleted achievement file (no backup): ${achievementFile}`
            );
          }
        } catch (error) {
          console.warn(
            `[Installer] Failed to restore/delete achievement file ${achievementFile}:`,
            error
          );
        }
      }

      // Update installation info - remove achievements component
      installInfo.components.achievements = { installed: false, files: [] };
    }

    // Save updated installation info
    await saveInstallationInfo(gamePath, installInfo);

    console.log(`[Installer] Components removed successfully for ${game.id}`);
  } catch (error) {
    console.error('[Installer] Error removing components:', error);
    throw new Error(
      `Помилка видалення компонентів: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Check if translation is installed and get installation info
 * Priority: Library paths (Steam, GOG, etc.) > Manual/cached paths
 */
export async function checkInstallation(game: Game): Promise<InstallationInfo | null> {
  try {
    console.log(`[Installer] Checking installation for: ${game.id}`);

    // PRIORITY 1: Check standard library paths first (Steam, GOG, Epic, etc.)
    // This ensures that if user installed game via Steam after manual installation,
    // the library path takes priority
    const gamePath = getFirstAvailableGamePath(game.install_paths || []);

    if (gamePath && gamePath.exists) {
      // Check for installation info file in library path
      const infoPath = path.join(gamePath.path, INSTALLATION_INFO_FILE);

      if (fs.existsSync(infoPath)) {
        // Read installation info from library path
        const infoContent = await fs.promises.readFile(infoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        console.log(
          `[Installer] Translation found in library path: ${gamePath.path}, version ${info.version}`
        );
        console.log(
          `[Installer] Components: voice=${info.components?.voice?.installed}, achievements=${info.components?.achievements?.installed}`
        );

        // Update cache to point to library path (only if changed to avoid triggering watcher loop)
        const userDataPath = app.getPath('userData');
        const installInfoDir = path.join(userDataPath, 'installation-cache');
        const cacheInfoPath = path.join(installInfoDir, `${game.id}.json`);

        try {
          await mkdir(installInfoDir, { recursive: true });

          // Check if cache already has the same data
          let needsUpdate = true;
          if (fs.existsSync(cacheInfoPath)) {
            try {
              const existingContent = await fs.promises.readFile(cacheInfoPath, 'utf-8');
              const existingInfo = JSON.parse(existingContent);
              // Compare key fields and components to avoid unnecessary writes
              const sameComponents =
                existingInfo.components?.voice?.installed ===
                  info.components?.voice?.installed &&
                existingInfo.components?.achievements?.installed ===
                  info.components?.achievements?.installed;

              if (
                existingInfo.gamePath === info.gamePath &&
                existingInfo.version === info.version &&
                existingInfo.gameId === info.gameId &&
                sameComponents
              ) {
                needsUpdate = false;
              }
            } catch {
              // If we can't read existing, we need to update
            }
          }

          if (needsUpdate) {
            await fs.promises.writeFile(
              cacheInfoPath,
              JSON.stringify(info, null, 2),
              'utf-8'
            );
            console.log(`[Installer] Updated cache with library path: ${cacheInfoPath}`);
          }
        } catch (cacheError) {
          console.warn('[Installer] Failed to update cache:', cacheError);
        }

        return info;
      }
    }

    // PRIORITY 2: Check cached/manual installation paths
    // Only if game is NOT found in standard library locations
    const previousInstallInfoPath = getPreviousInstallPath(game.id);
    if (previousInstallInfoPath && fs.existsSync(previousInstallInfoPath)) {
      try {
        const infoContent = await fs.promises.readFile(previousInstallInfoPath, 'utf-8');
        const info: InstallationInfo = JSON.parse(infoContent);

        // Verify the path still exists AND the installation info file exists in game folder
        const gameInfoPath = path.join(info.gamePath, INSTALLATION_INFO_FILE);
        if (fs.existsSync(info.gamePath) && fs.existsSync(gameInfoPath)) {
          // Additional check: if this cached path is NOT a library path, use it
          // (library paths were already checked above and didn't have translation)
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

    // No translation found
    if (!gamePath || !gamePath.exists) {
      console.log(`[Installer] Game not installed on this computer`);
    } else {
      console.log(`[Installer] No translation installed (info file not found)`);
    }

    return null;
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
 * Remove orphaned installation metadata (games that no longer exist on disk)
 */
export async function removeOrphanedInstallationMetadata(
  gameIds: string[]
): Promise<void> {
  if (gameIds.length === 0) return;

  console.log(
    `[Installer] Removing ${gameIds.length} orphaned installation metadata files`
  );

  const userDataPath = app.getPath('userData');
  const installInfoDir = path.join(userDataPath, 'installation-cache');

  for (const gameId of gameIds) {
    try {
      const metadataPath = path.join(installInfoDir, `${gameId}.json`);

      if (fs.existsSync(metadataPath)) {
        await unlink(metadataPath);
        console.log(`[Installer] Removed metadata for game: ${gameId}`);
      }
    } catch (error) {
      console.error(`[Installer] Error removing metadata for game ${gameId}:`, error);
    }
  }

  // Invalidate cache after cleanup
  invalidateInstalledGameIdsCache();
}

/**
 * Get all installed game IDs from installation cache (with caching)
 */
export async function getAllInstalledGameIds(): Promise<string[]> {
  // Return cached value if available
  if (installedGameIdsCache !== null) {
    console.log(
      `[Installer] Using cached installed games (${installedGameIdsCache.length} games)`
    );
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
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));

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
 * Verify file hash - supports both new fingerprint hash and legacy full SHA-256
 * For files ≤100MB: full SHA-256 hash
 * For files >100MB: try fingerprint first, fallback to full SHA-256 for backward compatibility
 */
async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  const FULL_HASH_LIMIT = 100 * 1024 * 1024; // 100MB
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Small files - always use full SHA-256
    if (fileSize <= FULL_HASH_LIMIT) {
      console.log(
        `[Hash] Small file (${(fileSize / 1024 / 1024).toFixed(1)}MB), using full SHA-256`
      );
      const actualHash = await calculateFullHash(filePath);
      console.log(`[Hash] Expected: ${expectedHash}`);
      console.log(`[Hash] Actual:   ${actualHash}`);
      return actualHash === expectedHash;
    }

    // Large files - try fingerprint hash first (new format)
    console.log(
      `[Hash] Large file (${(fileSize / 1024 / 1024).toFixed(1)}MB), trying fingerprint hash first`
    );
    const fingerprintHash = await calculateFingerprintHash(
      filePath,
      fileSize,
      CHUNK_SIZE
    );
    console.log(`[Hash] Expected:    ${expectedHash}`);
    console.log(`[Hash] Fingerprint: ${fingerprintHash}`);

    if (fingerprintHash === expectedHash) {
      console.log(`[Hash] ✓ Fingerprint hash matched`);
      return true;
    }

    // Fallback to full SHA-256 for backward compatibility with old hashes
    console.log(`[Hash] Fingerprint mismatch, trying full SHA-256 (legacy)...`);
    const fullHash = await calculateFullHash(filePath);
    console.log(`[Hash] Full SHA-256: ${fullHash}`);

    if (fullHash === expectedHash) {
      console.log(`[Hash] ✓ Full SHA-256 hash matched (legacy)`);
      return true;
    }

    console.log(`[Hash] ✗ No hash matched`);
    return false;
  } catch (error) {
    console.error('[Hash] Error verifying file hash:', error);
    return false;
  }
}

/**
 * Calculate full SHA-256 hash using streaming
 */
async function calculateFullHash(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Calculate fingerprint hash for large files
 * Hash of: first 10MB + last 10MB + file size (as 8-byte little-endian)
 */
async function calculateFingerprintHash(
  filePath: string,
  fileSize: number,
  chunkSize: number
): Promise<string> {
  const fd = fs.openSync(filePath, 'r');

  try {
    // Read first chunk
    const firstChunk = Buffer.alloc(chunkSize);
    fs.readSync(fd, firstChunk, 0, chunkSize, 0);

    // Read last chunk
    const lastChunk = Buffer.alloc(chunkSize);
    fs.readSync(fd, lastChunk, 0, chunkSize, fileSize - chunkSize);

    // Create size buffer (8 bytes, little-endian, like browser BigUint64)
    const sizeBuffer = Buffer.alloc(8);
    sizeBuffer.writeBigUInt64LE(BigInt(fileSize), 0);

    // Combine and hash
    const combined = Buffer.concat([firstChunk, lastChunk, sizeBuffer]);
    const hash = createHash('sha256');
    hash.update(combined);
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Get Steam achievements path (Steam/appcache/stats)
 * Always uses the main Steam installation path, not the game's library folder
 */
async function getSteamAchievementsPath(): Promise<string | null> {
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
 * Parse size string like "150.00 MB" to bytes (reverse of formatBytes)
 */
function parseSizeToBytes(sizeString: string): number {
  const match = sizeString.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 0);
}

/**
 * Check available disk space
 */
async function checkDiskSpace(targetPath: string): Promise<number> {
  try {
    if (!targetPath) {
      console.warn('[DiskSpace] No target path provided, skipping disk space check');
      return Number.MAX_SAFE_INTEGER;
    }
    const stats = await fs.promises.statfs(targetPath);
    // Available space = block size * available blocks
    return stats.bavail * stats.bsize;
  } catch (error) {
    console.error('[DiskSpace] Error checking disk space:', error);
    // Return a large number to not block installation if we can't check
    return Number.MAX_SAFE_INTEGER;
  }
}
