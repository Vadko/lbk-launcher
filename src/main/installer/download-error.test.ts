import { describe, expect, it } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import { classifyDownloadError } from './download-error';
import { NetworkError } from './errors';

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

function abortedSignal(reason: string): AbortSignal {
  const controller = new AbortController();
  controller.abort(reason);
  return controller.signal;
}

describe('classifyDownloadError', () => {
  it.each([
    [
      'got ReadError on a dropped response',
      withCode('The server aborted pending request', 'ECONNRESET'),
    ],
    ['socket reset', withCode('read ECONNRESET', 'ECONNRESET')],
    ['socket hang up', new Error('socket hang up')],
    [
      'short body',
      withCode('Content-Length mismatch', 'ERR_HTTP_CONTENT_LENGTH_MISMATCH'),
    ],
  ])('%s is a resumable reset', (_label, error) => {
    const { error: classified, status } = classifyDownloadError(error);
    expect(classified).toBeInstanceOf(NetworkError);
    expect(classified.message).toBe(t('download.connectionReset'));
    expect(status).toEqual({ message: t('download.connectionReset'), tone: 'error' });
  });

  it.each([
    [
      'DNS failure',
      new Error('getaddrinfo ENOTFOUND example.com'),
      t('download.connectFailed'),
    ],
    [
      'timeout',
      new Error('Timeout awaiting response for 30000ms'),
      t('download.timeout'),
    ],
    [
      'refused',
      new Error('connect ECONNREFUSED 1.2.3.4:443'),
      t('download.serverUnavailableRetry'),
    ],
  ])('%s is a network error', (_label, error, message) => {
    const { error: classified } = classifyDownloadError(error);
    expect(classified).toBeInstanceOf(NetworkError);
    expect(classified.message).toBe(message);
  });

  it('keeps a cancel by the player as it is', () => {
    const error = new Error(t('download.cancelled'));
    const { error: classified, status } = classifyDownloadError(
      error,
      abortedSignal(t('download.cancelled'))
    );
    expect(classified).toBe(error);
    expect(classified).not.toBeInstanceOf(NetworkError);
    expect(status).toEqual({ message: error.message, tone: 'error' });
  });

  it('turns a lost connection abort into a network error', () => {
    const { error: classified, status } = classifyDownloadError(
      new Error('NETWORK_LOST'),
      abortedSignal('NETWORK_LOST')
    );
    expect(classified).toBeInstanceOf(NetworkError);
    expect(status).toBeUndefined();
  });

  it('passes a pause through without a status', () => {
    const error = new Error('PAUSED');
    expect(classifyDownloadError(error, abortedSignal('PAUSED'))).toEqual({ error });
  });

  it('wraps an unknown failure', () => {
    const { error: classified, status } = classifyDownloadError(new Error('EACCES'));
    expect(classified).not.toBeInstanceOf(NetworkError);
    expect(classified.message).toBe(t('download.failedWithError', { error: 'EACCES' }));
    expect(status).toEqual({
      message: t('download.failedCheckConnection'),
      tone: 'error',
    });
  });
});
