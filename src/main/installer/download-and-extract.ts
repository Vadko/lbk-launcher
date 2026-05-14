import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type {
  DownloadProgress,
  Game,
  InstallationStatus,
  InstallOptions,
} from '../../shared/types';
import { getSignedDownloadUrl } from '../tracking';
import { extractArchive } from './archive';
import {
  downloadFile,
  setCurrentDownloadState,
  setDownloadAbortController,
} from './download';
import { RateLimitError } from './errors';
import { getAllFiles } from './files';
import { verifyFileHash } from './hash';

const unlink = promisify(fs.unlink);

export type ArchiveType = 'text' | 'voice' | 'achievements';

export interface DownloadContext {
  options: InstallOptions;
  platform: string;
  customGamePath?: string;
}

export interface DownloadAndExtractParams {
  game: Game;
  type: ArchiveType;
  archivePath: string | undefined | null;
  archiveHash: string | undefined | null;
  downloadDir: string;
  extractDir: string;
  isFirstSession?: boolean;
  onDownloadProgress?: (progress: DownloadProgress) => void;
  onStatus?: (status: InstallationStatus) => void;
  downloadContext?: DownloadContext;
}

/**
 * Fetch a signed URL, download the archive, verify its hash, and extract it.
 * Returns the list of extracted files (relative to extractDir).
 */
export async function downloadAndExtractArchive(
  params: DownloadAndExtractParams
): Promise<string[]> {
  const {
    game,
    type,
    archivePath,
    archiveHash,
    downloadDir,
    extractDir,
    isFirstSession = false,
    onDownloadProgress,
    onStatus,
    downloadContext,
  } = params;

  if (!archivePath) {
    throw new Error(`Архів ${type} не знайдено`);
  }

  const archiveExt = path.extname(archivePath) || '.zip';
  const archiveFilePath = path.join(downloadDir, `${game.id}_${type}${archiveExt}`);

  onStatus?.({ message: 'Отримання посилання для завантаження...', phase: 'download' });
  const urlResult = await getSignedDownloadUrl({
    gameId: game.id,
    archivePath,
    archiveType: type,
    isFirstSession,
  });

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

  const abortController = new AbortController();
  setDownloadAbortController(abortController);

  // Pause tracking is only relevant for the main text archive.
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

  if (archiveHash) {
    onStatus?.({ message: 'Перевірка цілісності файлу...', phase: 'install' });
    const isValid = await verifyFileHash(archiveFilePath, archiveHash);
    if (!isValid) {
      if (fs.existsSync(archiveFilePath)) {
        await unlink(archiveFilePath);
      }
      throw new Error('Файл пошкоджено. Спробуйте завантажити ще раз.');
    }
  }

  await extractArchive(archiveFilePath, extractDir, onStatus);

  return await getAllFiles(extractDir);
}
