import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { getFirstAvailableGamePath } from './game-detector';
import type {
  InstallationInfo,
  Game,
  DownloadProgress,
  InstallationStatus,
  InstallOptions,
  PausedDownloadState,
} from '../shared/types';
import { formatBytes } from '../shared/formatters';

// Import all utilities from installer modules
import {
  ManualSelectionError,
  RateLimitError,
  PausedSignal,
  abortCurrentDownload,
  downloadFile,
  setDownloadAbortController,
  setCurrentDownloadState,
  clearPausedDownloadState,
  extractArchive,
  backupFiles,
  restoreBackupLegacy,
  restoreBackupNew,
  cleanupEmptyDirectories,
  BACKUP_SUFFIX,
  getAllFiles,
  copyDirectory,
  cleanupDownloadDir,
  deleteDirectory,
  checkPlatformCompatibility,
  getInstallerFileName,
  hasExecutableInstaller,
  runInstaller,
  getSteamAchievementsPath,
  verifyFileHash,
  saveInstallationInfo,
  checkInstallation,
  invalidateInstalledGameIdsCache,
  removeOrphanedInstallationMetadata,
  getAllInstalledGameIds,
  deleteCachedInstallationInfo,
  getConflictingTranslation,
  INSTALLATION_INFO_FILE,
  parseSizeToBytes,
  checkDiskSpace,
} from './installer/index';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

const BACKUP_DIR_NAME = '.lbk-backup';

// Re-export utilities for external use
export {
  ManualSelectionError,
  RateLimitError,
  PausedSignal,
  abortCurrentDownload,
  checkPlatformCompatibility,
  checkInstallation,
  invalidateInstalledGameIdsCache,
  removeOrphanedInstallationMetadata,
  getAllInstalledGameIds,
  getConflictingTranslation,
};

/**
 * Resume a paused download
 */
export async function resumeDownload(
  state: PausedDownloadState,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  console.log(`[Installer] Resuming download for game: ${state.gameId}`);

  const { getSignedDownloadUrl } = await import('./tracking');

  // Check if URL might be expired (> 55 minutes since pause - signed URLs expire in 1 hour)
  const pausedTime = new Date(state.pausedAt).getTime();
  const now = Date.now();
  const fiftyFiveMinutes = 55 * 60 * 1000;

  let downloadUrl = state.url;
  if (now - pausedTime > fiftyFiveMinutes) {
    onStatus?.({ message: 'Оновлення посилання на завантаження...' });
    console.log('[Installer] Signed URL might be expired, getting new one...');

    // Extract archive path from the original URL or use a fallback approach
    // Since we don't store the archive path in PausedDownloadState, we'll need to refresh via game data
    // For now, we'll try with the old URL and if it fails, the error will be handled
    try {
      // Try to get a fresh URL using the archive path pattern
      const archivePathMatch = state.url.match(/\/([^/]+\.(zip|rar|7z))/);
      if (archivePathMatch) {
        const urlResult = await getSignedDownloadUrl(state.gameId, archivePathMatch[1]);
        if (urlResult.success) {
          downloadUrl = urlResult.downloadUrl;
          console.log('[Installer] Got fresh signed URL');
        }
      }
    } catch (error) {
      console.warn('[Installer] Failed to refresh URL, will try with old one:', error);
    }
  }

  // Set up download state tracking
  setCurrentDownloadState({
    gameId: state.gameId,
    url: downloadUrl,
    outputPath: state.outputPath,
    downloadedBytes: state.downloadedBytes,
    totalBytes: state.totalBytes,
    options: state.options,
    platform: state.platform,
    customGamePath: state.customGamePath,
  });

  // Create AbortController for this download
  const abortController = new AbortController();
  setDownloadAbortController(abortController);

  try {
    onStatus?.({ message: 'Продовження завантаження...' });

    await downloadFile(
      downloadUrl,
      state.outputPath,
      onDownloadProgress,
      onStatus,
      3,
      abortController.signal,
      state.downloadedBytes
    );

    // Download complete - clear paused state
    clearPausedDownloadState(state.gameId);

    onStatus?.({ message: 'Завантаження завершено!' });
    console.log('[Installer] Resume download completed successfully');
  } catch (error) {
    // If paused again, don't treat as error
    if (error instanceof Error && error.message === 'PAUSED') {
      console.log('[Installer] Download paused again');
      return;
    }
    throw error;
  } finally {
    setDownloadAbortController(null);
    setCurrentDownloadState(null);
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
    console.log(`[Installer] Requested platform: ${platform}`);

    // 1. Check platform compatibility for installer-based translations
    const platformError = checkPlatformCompatibility(game);
    if (platformError) {
      console.error(`[Installer] Platform incompatible: ${platformError}`);
      throw new Error(platformError);
    }

    // 2. Detect game installation path
    // If license_only is enabled, don't allow custom path selection
    if (game.license_only && customGamePath) {
      console.error(
        `[Installer] Manual selection not allowed for license-only game: ${game.id}`
      );
      throw new Error(
        `Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\n` +
          `Ручний вибір папки заборонено.`
      );
    }

    const gamePath = customGamePath
      ? { platform, path: customGamePath, exists: true }
      : getFirstAvailableGamePath(game.install_paths || []);

    if (!gamePath || !gamePath.exists || !gamePath.path) {
      console.error(`[Installer] Game not found. Searched paths:`, game.install_paths);
      const platformPath = (game.install_paths || []).find(
        (p) => p.type === platform
      )?.path;

      // If license_only, show a different error message
      if (game.license_only) {
        throw new Error(
          `Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\n` +
            `Гру не знайдено автоматично. Переконайтеся, що ліцензійна версія гри встановлена через Steam, GOG чи Epic Games.`
        );
      }

      throw new ManualSelectionError(
        `Гру не знайдено автоматично.\n\n` +
          `Шукали папку: ${platformPath || 'не вказано'}\n\n` +
          `Виберіть папку з грою вручну.`
      );
    }

    console.log(`[Installer] ✓ Game found at: ${gamePath.path} (${gamePath.platform})`);

    // 3. Check available disk space
    let requiredSpace = 0;
    if (installText) {
      // Use epic_archive_size if platform is 'epic' and epic_archive is available
      const textArchiveSize =
        gamePath.platform === 'epic' && game.epic_archive_size
          ? game.epic_archive_size
          : game.archive_size;
      if (textArchiveSize) {
        requiredSpace += parseSizeToBytes(textArchiveSize);
      }
    }
    if (installVoice && game.voice_archive_size) {
      requiredSpace += parseSizeToBytes(game.voice_archive_size);
    }
    if (installAchievements && game.achievements_archive_size) {
      requiredSpace += parseSizeToBytes(game.achievements_archive_size);
    }

    if (requiredSpace > 0) {
      const neededSpace = requiredSpace * 3; // 3x for archive + extracted + final copy
      const diskSpace = await checkDiskSpace(gamePath.path);

      if (diskSpace < neededSpace) {
        throw new Error(
          `Недостатньо місця на диску.\n\n` +
            `Необхідно: ${formatBytes(neededSpace)}\n` +
            `Доступно: ${formatBytes(diskSpace)}\n\n` +
            `Звільніть місце та спробуйте знову.`
        );
      }
      console.log(`[Installer] ✓ Disk space check passed`);
    }

    // 4. Download archives
    const tempDir = app.getPath('temp');
    const downloadDir = path.join(tempDir, 'lbk-downloads');
    await mkdir(downloadDir, { recursive: true });

    const { getSignedDownloadUrl } = await import('./tracking');
    const extractDir = path.join(downloadDir, `${game.id}_extract`);

    // 4.1 Download text archive if requested
    let textFiles: string[] = [];
    if (installText) {
      // Use epic_archive if platform is 'epic' and epic_archive is available
      const useEpicArchive = gamePath.platform === 'epic' && game.epic_archive_path;
      const archivePath = useEpicArchive ? game.epic_archive_path : game.archive_path;
      const archiveHash = useEpicArchive ? game.epic_archive_hash : game.archive_hash;

      if (useEpicArchive) {
        console.log('[Installer] Using Epic-specific archive');
      }

      textFiles = await downloadAndExtractArchive(
        game,
        'text',
        archivePath,
        archiveHash,
        downloadDir,
        extractDir,
        getSignedDownloadUrl,
        onDownloadProgress,
        onStatus,
        { options, platform: gamePath.platform, customGamePath }
      );
    }

    // 4.2 Download voice archive if requested
    let voiceFiles: string[] = [];
    if (installVoice && game.voice_archive_path) {
      const voiceExtractDir = path.join(downloadDir, `${game.id}_voice_extract`);
      voiceFiles = await downloadAndExtractArchive(
        game,
        'voice',
        game.voice_archive_path,
        game.voice_archive_hash,
        downloadDir,
        voiceExtractDir,
        getSignedDownloadUrl,
        onDownloadProgress,
        (status) => onStatus?.({ message: `Озвучення: ${status.message}` })
      );
      // Copy voice files to main extract directory
      await copyDirectory(voiceExtractDir, extractDir);
    }

    // 4.3 Download achievements archive if requested (Steam only)
    let achievementsFiles: string[] = [];
    let achievementsInstallPath: string | null = null;
    console.log(`[Installer] Achievements check:`, {
      installAchievements,
      hasArchivePath: !!game.achievements_archive_path,
      archivePath: game.achievements_archive_path,
      platform,
    });
    if (installAchievements && game.achievements_archive_path && platform === 'steam') {
      const achievementsExtractDir = path.join(
        downloadDir,
        `${game.id}_achievements_extract`
      );
      achievementsFiles = await downloadAndExtractArchive(
        game,
        'achievements',
        game.achievements_archive_path,
        game.achievements_archive_hash,
        downloadDir,
        achievementsExtractDir,
        getSignedDownloadUrl,
        onDownloadProgress,
        (status) => onStatus?.({ message: `Досягнення: ${status.message}` })
      );

      achievementsInstallPath = await getSteamAchievementsPath();
      if (achievementsInstallPath) {
        console.log(`[Installer] Installing achievements to: ${achievementsInstallPath}`);
        onStatus?.({ message: 'Копіювання перекладу ачівок...' });
        await mkdir(achievementsInstallPath, { recursive: true });

        // Find all achievement files (ignore folder structure from archive)
        const allExtractedFiles = await getAllFiles(achievementsExtractDir);
        const achievementFilesToCopy: { src: string; dest: string }[] = [];

        for (const relativePath of allExtractedFiles) {
          const fileName = path.basename(relativePath);
          const srcPath = path.join(achievementsExtractDir, relativePath);
          const destPath = path.join(achievementsInstallPath, fileName);
          achievementFilesToCopy.push({ src: srcPath, dest: destPath });
        }

        // Backup original files (not already installed translations)
        if (createBackup) {
          for (const { dest } of achievementFilesToCopy) {
            const backupPath = dest + BACKUP_SUFFIX;
            // Only backup if original exists and backup doesn't exist yet
            if (fs.existsSync(dest) && !fs.existsSync(backupPath)) {
              await fs.promises.copyFile(dest, backupPath);
              console.log(`[Installer] Backed up: ${path.basename(dest)}`);
            }
          }
        }

        // Copy files directly to achievements folder (flatten structure)
        for (const { src, dest } of achievementFilesToCopy) {
          await fs.promises.copyFile(src, dest);
          console.log(`[Installer] Copied achievement file: ${path.basename(dest)}`);
        }

        // Update achievementsFiles to contain only filenames (for installation info)
        achievementsFiles = achievementFilesToCopy.map(({ dest }) => path.basename(dest));
      }
    }

    // 5. Check for executable installer
    const installerFileName = getInstallerFileName(game);
    const isExeInstaller = hasExecutableInstaller(game);

    if (installerFileName && isExeInstaller) {
      const fullTargetPath = gamePath.path;
      console.log(`[Installer] Found executable installer: ${installerFileName}`);

      onStatus?.({ message: 'Копіювання файлів українізатора...' });
      await copyDirectory(extractDir, fullTargetPath);

      onStatus?.({ message: 'Очищення тимчасових файлів...' });
      await cleanupDownloadDir(downloadDir);

      await runInstaller(fullTargetPath, installerFileName);

      const installationInfo: InstallationInfo = {
        gameId: game.id,
        version: game.version || '1.0.0',
        installedAt: new Date().toISOString(),
        gamePath: gamePath.path,
        hasBackup: false,
        isCustomPath: !!customGamePath,
        installedFiles: [],
        components: { text: { installed: true, files: [] } },
      };
      await saveInstallationInfo(gamePath.path, installationInfo);
      return;
    }

    // 6. Copy files to game directory
    const additionalPath = game.additional_path || '';
    const fullTargetPath = additionalPath
      ? path.join(gamePath.path, additionalPath)
      : gamePath.path;
    let installedFiles: string[] = [];

    // Helper to prefix paths with additional_path
    const prefixPaths = (files: string[]) =>
      additionalPath ? files.map((f) => path.join(additionalPath, f)) : files;

    if (installText || installVoice) {
      installedFiles = await getAllFiles(extractDir);
      console.log(`[Installer] Will install ${installedFiles.length} files`);

      if (additionalPath) {
        console.log(`[Installer] Using additional_path: ${additionalPath}`);
        await mkdir(fullTargetPath, { recursive: true });
      }

      if (createBackup) {
        onStatus?.({ message: 'Створення резервної копії...' });
        await backupFiles(extractDir, fullTargetPath);
      }

      onStatus?.({ message: 'Копіювання файлів українізатора...' });
      await copyDirectory(extractDir, fullTargetPath);
    }

    // 7. Cleanup
    onStatus?.({ message: 'Очищення тимчасових файлів...' });
    await cleanupDownloadDir(downloadDir);

    // 8. Save installation info
    const installationInfo: InstallationInfo = {
      gameId: game.id,
      version: game.version || '1.0.0',
      installedAt: new Date().toISOString(),
      gamePath: gamePath.path,
      hasBackup: createBackup,
      isCustomPath: !!customGamePath,
      installedFiles: prefixPaths(installedFiles),
      components: {
        text: { installed: installText, files: prefixPaths(textFiles) },
        ...(installVoice && voiceFiles.length > 0
          ? { voice: { installed: true, files: prefixPaths(voiceFiles) } }
          : {}),
        ...(installAchievements && achievementsFiles.length > 0 && achievementsInstallPath
          ? {
              achievements: {
                installed: true,
                files: achievementsFiles,
              },
            }
          : {}),
      },
    };
    await saveInstallationInfo(gamePath.path, installationInfo);

    console.log(`[Installer] Translation for ${game.id} installed successfully`);
  } catch (error) {
    // Handle pause specially - throw PausedSignal for IPC handler
    if (error instanceof Error && error.message === 'PAUSED') {
      console.log('[Installer] Installation paused by user');
      throw new PausedSignal();
    }
    console.error('[Installer] Installation error:', error);
    handleInstallationError(error);
  }
}

type ArchiveType = 'text' | 'voice' | 'achievements';

interface DownloadContext {
  options: InstallOptions;
  platform: string;
  customGamePath?: string;
}

/**
 * Download and extract an archive
 */
async function downloadAndExtractArchive(
  game: Game,
  type: ArchiveType,
  archivePath: string | undefined | null,
  archiveHash: string | undefined | null,
  downloadDir: string,
  extractDir: string,
  getSignedDownloadUrl: (
    gameId: string,
    path: string,
    type?: ArchiveType
  ) => Promise<any>,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  downloadContext?: DownloadContext
): Promise<string[]> {
  if (!archivePath) {
    throw new Error(`Архів ${type} не знайдено`);
  }

  // Get extension from archive path (supports .zip, .rar, .7z)
  const archiveExt = path.extname(archivePath) || '.zip';
  const archiveFilePath = path.join(downloadDir, `${game.id}_${type}${archiveExt}`);

  onStatus?.({ message: 'Отримання посилання для завантаження...' });
  const urlResult = await getSignedDownloadUrl(game.id, archivePath, type);

  if (!urlResult.success) {
    if (urlResult.error === 'rate_limit_exceeded' && 'nextAvailableAt' in urlResult) {
      throw new RateLimitError(
        urlResult.nextAvailableAt,
        urlResult.downloadsToday,
        urlResult.maxAllowed
      );
    }
    throw new Error(`Не вдалося отримати посилання: ${urlResult.error}`);
  }

  // Create AbortController for this download
  const abortController = new AbortController();
  setDownloadAbortController(abortController);

  // Set download state for pause functionality (only for text archive - main download)
  if (downloadContext && type === 'text') {
    setCurrentDownloadState({
      gameId: game.id,
      url: urlResult.downloadUrl,
      outputPath: archiveFilePath,
      downloadedBytes: 0,
      totalBytes: 0,
      options: downloadContext.options,
      platform: downloadContext.platform,
      customGamePath: downloadContext.customGamePath,
    });
  }

  try {
    await downloadFile(
      urlResult.downloadUrl,
      archiveFilePath,
      onDownloadProgress,
      onStatus,
      3,
      abortController.signal
    );
  } finally {
    setDownloadAbortController(null);
    if (downloadContext && type === 'text') {
      setCurrentDownloadState(null);
    }
  }

  // Verify hash if available
  if (archiveHash) {
    onStatus?.({ message: 'Перевірка цілісності файлу...' });
    const isValid = await verifyFileHash(archiveFilePath, archiveHash);
    if (!isValid) {
      if (fs.existsSync(archiveFilePath)) {
        await unlink(archiveFilePath);
      }
      throw new Error('Файл пошкоджено. Спробуйте завантажити ще раз.');
    }
  }

  // Extract archive
  await extractArchive(archiveFilePath, extractDir, onStatus);

  // Get list of extracted files
  return await getAllFiles(extractDir);
}

/**
 * Handle installation errors with user-friendly messages
 */
function handleInstallationError(error: unknown): never {
  if (error instanceof ManualSelectionError || error instanceof RateLimitError) {
    throw error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes('err_connection_refused') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      throw new Error(
        'Не вдалося підключитися до сервера.\n\nПеревірте підключення до Інтернету.'
      );
    }
    if (message.includes('eacces') || message.includes('eperm')) {
      throw new Error(
        'Недостатньо прав для встановлення.\n\nЗапустіть застосунок від імені адміністратора.'
      );
    }
    if (message.includes('enospc')) {
      throw new Error(
        'Недостатньо місця на диску.\n\nЗвільніть місце та спробуйте знову.'
      );
    }
    if (message.includes('enoent')) {
      throw new Error(
        'Файл або папку не знайдено.\n\nПереконайтеся, що гра встановлена.'
      );
    }

    throw new Error(`Помилка встановлення: ${error.message}`);
  }

  throw new Error('Невідома помилка встановлення.\n\nСпробуйте ще раз.');
}

/**
 * Uninstall translation
 */
export async function uninstallTranslation(game: Game): Promise<void> {
  try {
    console.log(`[Installer] Uninstalling translation for: ${game.id}`);

    const installInfo = await checkInstallation(game);
    if (!installInfo) {
      throw new Error('Українізатор не встановлено');
    }

    const gamePath = installInfo.gamePath;
    const backupDir = path.join(gamePath, BACKUP_DIR_NAME);

    // Collect files to delete
    let allFilesToDelete: string[] = [];

    if (installInfo.components) {
      if (installInfo.components.text?.installed) {
        allFilesToDelete.push(...installInfo.components.text.files);
      }
      if (installInfo.components.voice?.installed) {
        allFilesToDelete.push(...installInfo.components.voice.files);
      }
      // Handle achievements separately (full paths)
      if (installInfo.components.achievements?.installed) {
        for (const achievementFile of installInfo.components.achievements.files) {
          await restoreOrDeleteFile(achievementFile);
        }
      }
    } else if (installInfo.installedFiles?.length) {
      allFilesToDelete = installInfo.installedFiles;
    }

    // Delete files
    if (allFilesToDelete.length > 0) {
      console.log(`[Installer] Deleting ${allFilesToDelete.length} installed files...`);
      for (const relativePath of allFilesToDelete) {
        const filePath = path.join(gamePath, relativePath);
        await deleteFileAndCleanupDirs(filePath, gamePath);
      }
    }

    // Restore from backup
    if (installInfo.hasBackup !== false) {
      if (fs.existsSync(backupDir)) {
        await restoreBackupLegacy(backupDir, gamePath);
        await deleteDirectory(backupDir);
      } else {
        await restoreBackupNew(gamePath, allFilesToDelete);
      }
    }

    // Cleanup
    await cleanupEmptyDirectories(gamePath, gamePath);

    // Delete installation info
    const infoPath = path.join(gamePath, INSTALLATION_INFO_FILE);
    if (fs.existsSync(infoPath)) {
      await unlink(infoPath);
    }
    await deleteCachedInstallationInfo(game.id);

    console.log(`[Installer] Translation for ${game.id} uninstalled successfully`);
  } catch (error) {
    console.error('[Installer] Uninstall error:', error);
    throw new Error(
      `Помилка видалення: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Remove specific components without full uninstall
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
      for (const relativePath of installInfo.components.voice.files) {
        const filePath = path.join(gamePath, relativePath);
        await restoreOrDeleteFile(filePath);
      }
      installInfo.components.voice = { installed: false, files: [] };
    }

    // Remove achievements component
    if (
      componentsToRemove.achievements &&
      installInfo.components?.achievements?.installed
    ) {
      for (const achievementFile of installInfo.components.achievements.files) {
        await restoreOrDeleteFile(achievementFile);
      }
      installInfo.components.achievements = { installed: false, files: [] };
    }

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
 * Restore from backup or delete file if no backup exists
 */
async function restoreOrDeleteFile(filePath: string): Promise<void> {
  const backupPath = filePath + BACKUP_SUFFIX;
  try {
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
      await fs.promises.rename(backupPath, filePath);
      console.log(`[Installer] Restored from backup: ${filePath}`);
    } else if (fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log(`[Installer] Deleted (no backup): ${filePath}`);
    }
  } catch (error) {
    console.warn(`[Installer] Failed to restore/delete ${filePath}:`, error);
  }
}

/**
 * Delete file and clean up empty parent directories
 */
async function deleteFileAndCleanupDirs(
  filePath: string,
  rootDir: string
): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log(`[Installer] Deleted: ${path.relative(rootDir, filePath)}`);

      // Clean up empty parent directories
      let dirPath = path.dirname(filePath);
      while (dirPath !== rootDir) {
        try {
          const entries = await readdir(dirPath);
          if (entries.length === 0) {
            await fs.promises.rmdir(dirPath);
            dirPath = path.dirname(dirPath);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    }
  } catch (error) {
    console.warn(`[Installer] Failed to delete ${filePath}:`, error);
  }
}
