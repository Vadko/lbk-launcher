import { ipcMain } from 'electron';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import { createTimer } from '../utils/logger';

interface HandleOrOptions {
  // Logs how long the handler took
  timed?: boolean;
}

export const orNull = (): null => null;

export const orEmpty = (): never[] => [];

export const orFailure = (error: unknown) => ({
  success: false as const,
  error: errorMessage(error, t('common.unknownError')),
});

// Handlers never throw across IPC, where an error loses its own fields; a failure answers the fallback
export function createHandleOr(tag: string) {
  return function handleOr<A extends unknown[], R, F>(
    channel: string,
    run: (...args: A) => R | Promise<R>,
    fallback: (error: unknown) => F,
    { timed = false }: HandleOrOptions = {}
  ): void {
    ipcMain.handle(channel, async (_event, ...args: A): Promise<R | F> => {
      const timer = timed ? createTimer(`IPC: ${channel}`) : null;
      try {
        return await run(...args);
      } catch (error) {
        console.error(`[${tag}] ${channel} failed:`, error);
        return fallback(error);
      } finally {
        timer?.end();
      }
    });
  };
}
