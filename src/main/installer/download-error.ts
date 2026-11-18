import { HTTPError } from 'got';
import { errnoCode } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { InstallationStatus } from '../../shared/types';
import { NetworkError } from './errors';

interface ClassifiedDownloadError {
  error: Error;
  status?: InstallationStatus;
}

function networkFailure(message: string, status = message): ClassifiedDownloadError {
  return { error: new NetworkError(message), status: { message: status, tone: 'error' } };
}

// Only the signal tells a cancel apart: got's own reset reads "The server aborted pending request".
export function classifyDownloadError(
  error: unknown,
  signal?: AbortSignal
): ClassifiedDownloadError {
  if (error instanceof Error && error.message.toLowerCase() === 'paused') {
    return { error };
  }

  if (signal?.aborted) {
    if (signal.reason === 'NETWORK_LOST') {
      return { error: new NetworkError(t('download.connectionLost')) };
    }
    const cancelled = error instanceof Error ? error : new Error(t('download.cancelled'));
    return { error: cancelled, status: { message: cancelled.message, tone: 'error' } };
  }

  if (error instanceof HTTPError) {
    const { statusCode, statusMessage = '' } = error.response;
    if ([408, 504, 524].includes(statusCode) || /timeout/i.test(statusMessage)) {
      return networkFailure(t('download.timeout'));
    }
    return {
      error: new Error(t('download.httpError', { statusCode, statusMessage }).trim()),
      status: { message: t('download.failed'), tone: 'error' },
    };
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = errnoCode(error);

    if (message.includes('enotfound') || message.includes('getaddrinfo')) {
      return networkFailure(t('download.connectFailed'), t('download.noInternet'));
    }

    if (message.includes('etimedout') || message.includes('timeout')) {
      return networkFailure(t('download.timeout'));
    }

    if (
      code === 'ECONNRESET' ||
      code === 'ERR_HTTP_CONTENT_LENGTH_MISMATCH' ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    ) {
      return networkFailure(t('download.connectionReset'));
    }

    if (message.includes('econnrefused')) {
      return networkFailure(
        t('download.serverUnavailableRetry'),
        t('download.serverUnavailable')
      );
    }
  }

  return {
    error: new Error(
      t('download.failedWithError', {
        error: error instanceof Error ? error.message : t('common.unknownError'),
      })
    ),
    status: { message: t('download.failedCheckConnection'), tone: 'error' },
  };
}
