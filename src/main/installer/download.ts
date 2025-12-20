import fs from 'fs';
import { promisify } from 'util';
import got from 'got';
import type { DownloadProgress, InstallationStatus } from '../../shared/types';

const unlink = promisify(fs.unlink);

// Global AbortController for cancelling current download
let currentDownloadAbortController: AbortController | null = null;

/**
 * Abort current download
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

      // Show user that error occurred
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
        // Also don't retry if cancelled
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

  // Abort handler
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

    // If already cancelled - stop immediately
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
