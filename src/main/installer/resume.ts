import type {
  DownloadProgress,
  InstallationStatus,
  PausedDownloadState,
} from '../../shared/types';
import { getSignedDownloadUrl } from '../tracking';
import {
  clearPausedDownloadState,
  downloadFile,
  setCurrentDownloadState,
  setDownloadAbortController,
} from './download';

/**
 * Resume a paused download. Refreshes the signed URL if more than 55 minutes
 * have elapsed since pause (signed URLs expire at 1 hour).
 */
export async function resumeDownload(
  state: PausedDownloadState,
  onDownloadProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void
): Promise<void> {
  console.log(`[Installer] Resuming download for game: ${state.gameId}`);

  const pausedTime = new Date(state.pausedAt).getTime();
  const now = Date.now();
  const fiftyFiveMinutes = 55 * 60 * 1000;

  let downloadUrl = state.url;
  if (now - pausedTime > fiftyFiveMinutes) {
    onStatus?.({
      message: 'Оновлення посилання на завантаження...',
      phase: 'download',
    });
    console.log('[Installer] Signed URL might be expired, getting new one...');

    try {
      const archivePathMatch = state.url.match(/\/([^/]+\.(zip|rar|7z))/);
      if (archivePathMatch) {
        const urlResult = await getSignedDownloadUrl({
          gameId: state.gameId,
          archivePath: archivePathMatch[1],
        });
        if (urlResult.success) {
          downloadUrl = urlResult.downloadUrl;
          console.log('[Installer] Got fresh signed URL');
        }
      }
    } catch (error) {
      console.warn('[Installer] Failed to refresh URL, will try with old one:', error);
    }
  }

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

  const abortController = new AbortController();
  setDownloadAbortController(abortController);

  try {
    onStatus?.({ message: 'Продовження завантаження...', phase: 'download' });

    await downloadFile(
      downloadUrl,
      state.outputPath,
      onDownloadProgress,
      onStatus,
      3,
      abortController.signal,
      state.downloadedBytes
    );

    clearPausedDownloadState(state.gameId);

    onStatus?.({ message: 'Завантаження завершено!', phase: 'install' });
    console.log('[Installer] Resume download completed successfully');
  } catch (error) {
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
