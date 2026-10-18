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

function handleOr<T, A = undefined>(
  channel: string,
  run: (arg: A) => Promise<T>,
  fallback: (error: unknown) => T
): void {
  ipcMain.handle(channel, (_event, arg: A) =>
    run(arg).catch((error: unknown) => {
      console.error(`[PluginHost] ${channel} failed:`, error);
      return fallback(error);
    })
  );
}

const crashed = (error: unknown): MillenniumInstallResult => ({
  success: false,
  reason: 'script-failed',
  error: errorMessage(error),
});

export function setupPluginHostHandlers(): void {
  handleOr('plugin-host:get-state', getPluginHostState, () => null);

  handleOr('millennium:prepare', prepareMillennium, crashed);

  handleOr(
    'millennium:activate',
    async (opts: { restart?: unknown } | undefined): Promise<MillenniumInstallResult> => {
      const restart = opts?.restart;
      if (!isRestartMode(restart)) {
        return { success: false, reason: 'not-prepared', error: 'bad args' };
      }
      return activateMillennium({ restart });
    },
    crashed
  );

  handleOr(
    'millennium:uninstall',
    async (
      opts: { purge?: unknown; restart?: unknown } | undefined
    ): Promise<MillenniumInstallResult> => {
      const restart = opts?.restart;
      if (typeof opts?.purge !== 'boolean' || !isRestartMode(restart)) {
        return { success: false, reason: 'unsupported', error: 'bad args' };
      }
      return uninstallMillennium({ purge: opts.purge, restart });
    },
    crashed
  );

  ipcMain.handle('millennium:cancel', () => cancelMillennium());

  handleOr(
    'decky:request-plugin-install',
    requestDeckyPluginInstall,
    (error): DeckyInstallResult => ({
      success: false,
      reason: 'failed',
      error: errorMessage(error),
    })
  );

  handleOr(
    'decky:install-loader',
    installDeckyLoader,
    (error): DeckyLoaderInstallResult => ({
      success: false,
      reason: 'not-installed',
      error: errorMessage(error),
    })
  );

  ipcMain.handle('decky:save-plugin-zip', () => saveDeckyPluginZip());

  handleOr(
    'restart-steam',
    async () => (await restartSteamOrchestrated({ verifyBridge: true })).result,
    (error): RestartSteamResult => ({
      success: false,
      error: errorMessage(error, 'Не вдалося перезапустити Steam'),
    })
  );

  handleOr('get-steam-bridge-status', getSteamBridgeStatus, () => null);

  handleOr('recheck-steam-bridge', recheckSteamBridge, () => null);

  ipcMain.handle('set-steam-cef-debugging', (_event, enabled: boolean) =>
    setCefDebuggingEnabled(enabled)
  );
}
