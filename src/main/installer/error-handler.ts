import { ManualSelectionError, NetworkError, RateLimitError } from './errors';

/**
 * Translate low-level install errors into Ukrainian user-facing messages.
 * Pass-through for typed errors (ManualSelectionError, RateLimitError,
 * NetworkError) that already carry structured info the renderer handles.
 */
export function handleInstallationError(error: unknown): never {
  if (
    error instanceof ManualSelectionError ||
    error instanceof RateLimitError ||
    error instanceof NetworkError
  ) {
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

    throw new Error(error.message);
  }

  throw new Error('Невідома помилка встановлення.\n\nСпробуйте ще раз.');
}
