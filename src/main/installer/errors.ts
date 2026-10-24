import { t } from '@/shared/i18n/i18n';

/**
 * Error that requires manual folder selection
 */
export class ManualSelectionError extends Error {
  public readonly needsManualSelection = true;

  constructor(message: string) {
    super(message);
    this.name = 'ManualSelectionError';
  }
}

/**
 * Signal indicating download was paused by user.
 * Not a real error - just a way to propagate pause state through the async call stack
 * since AbortController.abort() always throws.
 */
export class PausedSignal extends Error {
  public readonly isPaused = true;

  constructor() {
    super('Download paused');
    this.name = 'PausedSignal';
  }
}

/**
 * Network error that preserves partial download for retry.
 * When thrown, the .part file is NOT deleted so the user can resume later.
 */
export class NetworkError extends Error {
  public readonly isNetworkError = true;

  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Rate-limit error for downloads
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
      ? nextTime.toLocaleString('uk-UA', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Kyiv',
        })
      : t('downloadLimit.unknownTime');

    super(
      t('downloadLimit.message', {
        used: t('downloadLimit.used', { count: downloadsToday }),
        max: t('downloadLimit.max', { count: maxAllowed }),
        time: timeStr,
      })
    );
    this.name = 'RateLimitError';
    this.nextAvailableAt = nextAvailableAt;
    this.downloadsToday = downloadsToday;
    this.maxAllowed = maxAllowed;
  }
}
