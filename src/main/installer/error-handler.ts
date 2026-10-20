import { t } from '@/shared/i18n/i18n';
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
      throw new Error(t('installFailure.network'));
    }
    if (message.includes('eacces') || message.includes('eperm')) {
      throw new Error(t('installFailure.permission'));
    }
    if (message.includes('enospc')) {
      throw new Error(t('installFailure.diskSpace'));
    }
    if (message.includes('enoent')) {
      throw new Error(t('installFailure.notFound'));
    }

    throw new Error(error.message);
  }

  throw new Error(t('installFailure.unknown'));
}
