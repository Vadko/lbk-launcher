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
