import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import got from 'got';
import { app } from 'electron';
import type {
  DownloadProgress,
  InstallationStatus,
  PausedDownloadState,
  InstallOptions,
} from '../../shared/types';

const unlink = promisify(fs.unlink);

/**
 * Get file size via HEAD request
 * Returns 0 if size cannot be determined
 */
async function getFileSizeViaHead(url: string): Promise<number> {
  try {
    const response = await got.head(url, {
      followRedirect: true,
      headers: {
        'Accept-Encoding': 'identity',
      },
      timeout: {
        lookup: 5000,
        connect: 5000,
        secureConnect: 5000,
        response: 10000,
      },
    });

    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    return 0;
  } catch (error) {
    console.warn('[Downloader] HEAD request failed:', error);
    return 0;
  }
}

// Global AbortController for cancelling current download
let currentDownloadAbortController: AbortController | null = null;

// Current download state tracking for pause functionality
let currentDownloadState: {
  gameId: string;
  url: string;
  outputPath: string;
  downloadedBytes: number;
  totalBytes: number;
  options: InstallOptions;
  platform: string;
  customGamePath?: string;
} | null = null;

/**
 * Abort current download
 */
export function abortCurrentDownload(reason = 'Завантаження скасовано'): void {
  if (currentDownloadAbortController) {
    console.log('[Installer] Aborting current download:', reason);
    currentDownloadAbortController.abort(reason);
    currentDownloadAbortController = null;
  }
}

/**
 * Get current download abort controller
 */
export function getDownloadAbortController(): AbortController | null {
  return currentDownloadAbortController;
}

/**
 * Set current download abort controller
 */
export function setDownloadAbortController(controller: AbortController | null): void {
  currentDownloadAbortController = controller;
}

/**
 * Set current download state for pause functionality
 */
export function setCurrentDownloadState(state: typeof currentDownloadState): void {
  currentDownloadState = state;
}

/**
 * Update downloaded bytes in current state
 */
export function updateCurrentDownloadedBytes(bytes: number, totalBytes: number): void {
  if (currentDownloadState) {
    currentDownloadState.downloadedBytes = bytes;
    currentDownloadState.totalBytes = totalBytes;
  }
}

/**
 * Get paused downloads directory
 */
function getPausedDownloadsDir(): string {
  const dir = path.join(app.getPath('userData'), 'paused-downloads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save paused download state to disk
 */
export function savePausedDownloadState(state: PausedDownloadState): void {
  const filePath = path.join(getPausedDownloadsDir(), `${state.gameId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  console.log(`[Downloader] Saved paused download state for ${state.gameId}`);
}

/**
 * Get paused download state from disk
 */
export function getPausedDownloadState(gameId: string): PausedDownloadState | null {
  const filePath = path.join(getPausedDownloadsDir(), `${gameId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as PausedDownloadState;
  } catch (error) {
    console.error(
      `[Downloader] Failed to read paused download state for ${gameId}:`,
      error
    );
    return null;
  }
}

/**
 * Clear paused download state from disk
 */
export function clearPausedDownloadState(gameId: string): void {
  const filePath = path.join(getPausedDownloadsDir(), `${gameId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Downloader] Cleared paused download state for ${gameId}`);
    } catch (error) {
      console.error(
        `[Downloader] Failed to clear paused download state for ${gameId}:`,
        error
      );
    }
  }
}

/**
 * Pause current download and save state
 */
export function pauseCurrentDownload(gameId: string): PausedDownloadState | null {
  if (!currentDownloadAbortController || !currentDownloadState) {
    console.log('[Downloader] No active download to pause');
    return null;
  }

  if (currentDownloadState.gameId !== gameId) {
    console.log(
      `[Downloader] Active download is for different game: ${currentDownloadState.gameId}`
    );
    return null;
  }

  const state: PausedDownloadState = {
    gameId: currentDownloadState.gameId,
    url: currentDownloadState.url,
    outputPath: currentDownloadState.outputPath,
    downloadedBytes: currentDownloadState.downloadedBytes,
    totalBytes: currentDownloadState.totalBytes,
    pausedAt: new Date().toISOString(),
    options: currentDownloadState.options,
    platform: currentDownloadState.platform,
    customGamePath: currentDownloadState.customGamePath,
  };

  // Save state to disk
  savePausedDownloadState(state);

  // Abort with special reason
  console.log('[Downloader] Pausing download...');
  currentDownloadAbortController.abort('PAUSED');
  currentDownloadAbortController = null;
  currentDownloadState = null;

  return state;
}

/**
 * Get partial file path
 */
export function getPartialFilePath(outputPath: string): string {
  return `${outputPath}.part`;
}

/**
 * Download file from URL with progress tracking and retry logic
 * Uses .part files for partial downloads to support pause/resume
 */
export async function downloadFile(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  maxRetries = 3,
  signal?: AbortSignal,
  startByte = 0
): Promise<void> {
  let lastError: Error | null = null;
  const partialPath = getPartialFilePath(outputPath);

  // Check for existing partial file
  let currentStartByte = startByte;
  if (startByte === 0 && fs.existsSync(partialPath)) {
    currentStartByte = fs.statSync(partialPath).size;
    console.log(`[Downloader] Found partial file with ${currentStartByte} bytes`);
  }

  // Get file size via HEAD request (before download starts)
  const expectedTotalBytes = await getFileSizeViaHead(url);
  console.log(`[Downloader] Expected total bytes from HEAD: ${expectedTotalBytes}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check if cancelled
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

        // Check if cancelled during wait
        if (signal?.aborted) {
          throw new Error('Завантаження скасовано');
        }
      } else if (currentStartByte > 0) {
        onStatus?.({ message: 'Продовження завантаження...' });
      } else {
        onStatus?.({ message: 'Завантаження українізатора...' });
      }

      await downloadFileAttempt(
        url,
        partialPath,
        onProgress,
        onStatus,
        signal,
        currentStartByte,
        expectedTotalBytes
      );

      // Download complete - rename .part to final file
      if (fs.existsSync(outputPath)) {
        await unlink(outputPath);
      }
      fs.renameSync(partialPath, outputPath);
      console.log(`[Downloader] Renamed ${partialPath} to ${outputPath}`);

      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(
        `[Downloader] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      // Check if this is a pause (don't treat as error)
      if (error instanceof Error && error.message === 'PAUSED') {
        throw error; // Rethrow pause without cleanup
      }

      // Show user that error occurred
      const isNetworkError =
        error instanceof Error &&
        (error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('enotfound') ||
          error.message.toLowerCase().includes('etimedout') ||
          error.message.toLowerCase().includes('econnreset'));

      if (isNetworkError && attempt < maxRetries) {
        onStatus?.({ message: `Помилка мережі. Спроба ${attempt + 1}/${maxRetries}...` });
        // Don't clean up partial file on network error - we can resume
      }

      // Don't retry on certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('404') ||
          message.includes('not found') ||
          message.includes('forbidden')
        ) {
          // Clean up partial file on permanent errors
          if (fs.existsSync(partialPath)) {
            try {
              await unlink(partialPath);
            } catch (cleanupError) {
              console.warn(
                '[Downloader] Failed to clean up partial download:',
                cleanupError
              );
            }
          }
          throw error; // Don't retry on these errors
        }
        // Also don't retry if cancelled
        if (message.includes('скасовано') || message.includes('aborted')) {
          // Clean up partial file on cancel (but not on pause)
          if (!message.includes('paused') && fs.existsSync(partialPath)) {
            try {
              await unlink(partialPath);
            } catch (cleanupError) {
              console.warn(
                '[Downloader] Failed to clean up partial download:',
                cleanupError
              );
            }
          }
          throw error; // Don't retry on abort
        }
      }
    }
  }

  // All retries failed - clean up any partial file
  if (fs.existsSync(partialPath)) {
    try {
      await unlink(partialPath);
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
 * Single download attempt with Range header support for resume
 */
async function downloadFileAttempt(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  onStatus?: (status: InstallationStatus) => void,
  signal?: AbortSignal,
  startByte = 0,
  expectedTotalBytes = 0
): Promise<void> {
  console.log(
    `[Downloader] Starting download: ${url}${startByte > 0 ? ` (resuming from byte ${startByte})` : ''}`
  );

  // Open file in append mode if resuming, otherwise overwrite
  const writeStream = fs.createWriteStream(outputPath, {
    flags: startByte > 0 ? 'a' : 'w',
  });
  const startTime = Date.now();
  let lastUpdateTime = Date.now();
  let serverSupportsRange = true;
  // Use expectedTotalBytes from HEAD request as the source of truth
  let actualTotalBytes = expectedTotalBytes;

  // Abort handler
  const abortHandler = () => {
    console.log('[Downloader] Download aborted by signal');
    writeStream.close();
  };

  signal?.addEventListener('abort', abortHandler);

  try {
    // Add Range header if resuming
    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const downloadStream = got.stream(url, {
      followRedirect: true,
      headers,
      timeout: {
        lookup: 10000,
        connect: 10000,
        secureConnect: 10000,
        response: 30000,
      },
    });

    // Handle response to check for Range support
    downloadStream.on('response', (response) => {
      if (startByte > 0) {
        if (response.statusCode === 200) {
          // Server doesn't support range requests - need to restart
          console.warn(
            '[Downloader] Server does not support range requests, restarting from beginning'
          );
          serverSupportsRange = false;
          onStatus?.({ message: 'Сервер не підтримує продовження, перезапуск...' });
        } else if (response.statusCode === 416) {
          // Range not satisfiable - file may have changed on server
          console.error('[Downloader] Range not satisfiable (416)');
          throw new Error(
            'Файл на сервері змінився, потрібно перезапустити завантаження'
          );
        }
      }

      // Try to get size from Content-Range (for resumed downloads)
      const contentRange = response.headers['content-range'];
      if (contentRange) {
        const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
        if (match) {
          actualTotalBytes = parseInt(match[1], 10);
          console.log(
            '[Downloader] Got total size from Content-Range:',
            actualTotalBytes
          );
        }
      }
    });

    // If already cancelled - stop immediately
    if (signal?.aborted) {
      downloadStream.destroy();
      writeStream.close();
      const reason = signal?.reason || 'Завантаження скасовано';
      throw new Error(reason);
    }

    downloadStream.on('downloadProgress', (progress) => {
      const { transferred } = progress;

      // Throttle updates to every 500ms
      const now = Date.now();
      if (now - lastUpdateTime < 500) {
        return;
      }
      lastUpdateTime = now;

      // Calculate actual progress considering already downloaded bytes
      const actualTransferred = serverSupportsRange
        ? startByte + transferred
        : transferred;
      const actualTotal = actualTotalBytes;
      const actualPercent = actualTotal > 0 ? actualTransferred / actualTotal : 0;

      // Update current download state for pause functionality
      updateCurrentDownloadedBytes(actualTransferred, actualTotal);

      if (onProgress && actualTotal) {
        const elapsedTime = (now - startTime) / 1000; // in seconds
        const bytesPerSecond = elapsedTime > 0 ? transferred / elapsedTime : 0;
        const remainingBytes = actualTotal - actualTransferred;
        const timeRemaining = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

        onProgress({
          percent: actualPercent * 100,
          downloadedBytes: actualTransferred,
          totalBytes: actualTotal,
          bytesPerSecond,
          timeRemaining,
        });
      }
    });

    await new Promise<void>((resolve, reject) => {
      // If server doesn't support range, we need to truncate and start fresh
      if (!serverSupportsRange && startByte > 0) {
        writeStream.close();
        fs.truncateSync(outputPath, 0);
        const freshWriteStream = fs.createWriteStream(outputPath);

        const onFreshAbort = () => {
          downloadStream.destroy();
          freshWriteStream.close();
          reject(new Error(signal?.reason || 'Завантаження скасовано'));
        };

        signal?.addEventListener('abort', onFreshAbort);
        downloadStream.pipe(freshWriteStream);

        freshWriteStream.on('finish', () => {
          signal?.removeEventListener('abort', onFreshAbort);
          resolve();
        });

        freshWriteStream.on('error', (error) => {
          signal?.removeEventListener('abort', onFreshAbort);
          reject(error);
        });

        return;
      }

      downloadStream.pipe(writeStream);

      // Handle cancellation during download
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

      // Check for pause - don't show error message
      if (message === 'paused') {
        throw error;
      }

      // Check for cancellation
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
