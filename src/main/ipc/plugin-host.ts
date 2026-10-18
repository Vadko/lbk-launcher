import { ipcMain } from 'electron';
import { errorMessage } from '@/shared/errors';
import type {
  DeckyInstallResult,
  DeckyLoaderInstallResult,
  MillenniumInstallResult,
  RestartSteamResult,
} from '../../shared/plugin-host-types';
import {
  activateMillennium,
  cancelMillennium,
  prepareMillennium,
  uninstallMillennium,
} from '../millennium-install';
import { setCefDebuggingEnabled } from '../plugin-host/bridge-plugin-setup';
import {
  requestDeckyPluginInstall,
  saveDeckyPluginZip,
} from '../plugin-host/decky-install';
import { installDeckyLoader } from '../plugin-host/decky-loader-install';
import { getPluginHostState } from '../plugin-host/state';
import { restartSteamOrchestrated } from '../steam-restart';
import { getSteamBridgeStatus, recheckSteamBridge } from '../utils/steam-bridge';

function isRestartMode(value: unknown): value is 'now' | 'on-exit' {
  return value === 'now' || value === 'on-exit';
}

function crashed(scope: string, error: unknown): MillenniumInstallResult {
  console.error(`[Millennium] ${scope} crashed:`, error);
  return {
    success: false,
    reason: 'script-failed',
    error: errorMessage(error),
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
          error: errorMessage(error),
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
          error: errorMessage(error),
        };
      })
  );

  ipcMain.handle('decky:save-plugin-zip', () => saveDeckyPluginZip());

  ipcMain.handle('restart-steam', async (): Promise<RestartSteamResult> => {
    try {
      return (await restartSteamOrchestrated({ verifyBridge: true })).result;
    } catch (error) {
      console.error('[Steam] Restart failed:', error);
      return {
        success: false,
        error: errorMessage(error, 'Не вдалося перезапустити Steam'),
      };
    }
  });

  ipcMain.handle('get-steam-bridge-status', () =>
    getSteamBridgeStatus().catch((error: unknown) => {
      console.error('[Steam] Bridge status failed:', error);
      return null;
    })
  );

  ipcMain.handle('recheck-steam-bridge', () =>
    recheckSteamBridge().catch((error: unknown) => {
      console.error('[Steam] Bridge recheck failed:', error);
      return null;
    })
  );

  ipcMain.handle('set-steam-cef-debugging', (_event, enabled: boolean) =>
    setCefDebuggingEnabled(enabled)
  );
}
