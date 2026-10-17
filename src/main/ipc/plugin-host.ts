import { ipcMain } from 'electron';
import type {
  DeckyInstallResult,
  DeckyLoaderInstallResult,
  MillenniumInstallResult,
} from '../../shared/types';
import {
  activateMillennium,
  cancelMillennium,
  getPluginHostState,
  prepareMillennium,
  uninstallMillennium,
} from '../millennium-install';
import {
  requestDeckyPluginInstall,
  saveDeckyPluginZip,
} from '../plugin-host/decky-install';
import { installDeckyLoader } from '../plugin-host/decky-loader-install';

function isRestartMode(value: unknown): value is 'now' | 'on-exit' {
  return value === 'now' || value === 'on-exit';
}

function crashed(scope: string, error: unknown): MillenniumInstallResult {
  console.error(`[Millennium] ${scope} crashed:`, error);
  return {
    success: false,
    reason: 'script-failed',
    error: error instanceof Error ? error.message : String(error),
  };
}

export function setupPluginHostHandlers(): void {
  ipcMain.handle('plugin-host:get-state', () =>
    getPluginHostState().catch((error: unknown) => {
      console.error('[Millennium] State failed:', error);
      return null;
    })
  );

  ipcMain.handle('millennium:prepare', () =>
    prepareMillennium().catch((error: unknown) => crashed('Prepare', error))
  );

  ipcMain.handle(
    'millennium:activate',
    (
      _event,
      opts: { restart?: unknown } | undefined
    ): Promise<MillenniumInstallResult> => {
      const restart = opts?.restart;
      if (!isRestartMode(restart)) {
        return Promise.resolve({
          success: false,
          reason: 'not-prepared',
          error: 'bad args',
        });
      }
      return activateMillennium({ restart }).catch((error: unknown) =>
        crashed('Activate', error)
      );
    }
  );

  ipcMain.handle(
    'millennium:uninstall',
    (
      _event,
      opts: { purge?: unknown; restart?: unknown } | undefined
    ): Promise<MillenniumInstallResult> => {
      const restart = opts?.restart;
      if (typeof opts?.purge !== 'boolean' || !isRestartMode(restart)) {
        return Promise.resolve({
          success: false,
          reason: 'unsupported',
          error: 'bad args',
        });
      }
      return uninstallMillennium({ purge: opts.purge, restart }).catch((error: unknown) =>
        crashed('Uninstall', error)
      );
    }
  );

  ipcMain.handle('millennium:cancel', () => cancelMillennium());

  ipcMain.handle(
    'decky:request-plugin-install',
    (): Promise<DeckyInstallResult> =>
      requestDeckyPluginInstall().catch((error: unknown) => {
        console.error('[Decky] Install request crashed:', error);
        return {
          success: false,
          reason: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      })
  );

  ipcMain.handle(
    'decky:install-loader',
    (): Promise<DeckyLoaderInstallResult> =>
      installDeckyLoader().catch((error: unknown) => {
        console.error('[Decky] Loader install crashed:', error);
        return {
          success: false,
          reason: 'not-installed',
          error: error instanceof Error ? error.message : String(error),
        };
      })
  );

  ipcMain.handle('decky:save-plugin-zip', () => saveDeckyPluginZip());
}
