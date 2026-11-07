import { dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { SteamArtworkChangeResult } from '../../shared/installer-api-types';
import type { ApplyPendingLaunchOptionsResult } from '../../shared/plugin-host-types';
import type {
  Game,
  InstallOptions,
  InstallResult,
  RunInstallerDecision,
} from '../../shared/types';
import { appEvents } from '../app-events';
import { notifyCountersUpdated } from '../db/counters-updated';
import { GamesRepository } from '../db/games-repository';
import { installTranslation } from '../installer';
import {
  checkInstallation,
  getAllInstalledGameIds,
  getConflictingTranslation,
  removeOrphanedInstallationMetadata,
} from '../installer/cache';
import {
  abortCurrentDownload,
  clearPausedDownloadState,
  getPartialFilePath,
  getPausedDownloadState,
  pauseCurrentDownload,
} from '../installer/download';
import {
  ManualSelectionError,
  NetworkError,
  PausedSignal,
  RateLimitError,
} from '../installer/errors';
import { checkPlatformCompatibility, rerunInstaller } from '../installer/platform';
import { resumeDownload } from '../installer/resume';
import { answerRunInstaller, askRunInstaller } from '../installer/run-decisions';
import { setInstalledSteamArtwork } from '../installer/steam-integration';
import { removeComponents, uninstallTranslation } from '../installer/uninstall';
import { applyLaunchOptionsNow } from '../steam-restart';
import { trackUninstall } from '../tracking';
import { openExternalUrl } from '../utils/open-external';
import { hasSteamArtwork } from '../utils/steam-artwork';
import { readLastGameFolder, writeLastGameFolder } from '../utils/store-storage';
import { getMainWindow, sendToRenderer } from '../window';
import { createHandleOr, orEmpty, orFailure, orNull } from './handle-or';

const handleOr = createHandleOr('Installer');

const orFailureMessage = (error: unknown) => ({
  success: false as const,
  error: { message: errorMessage(error, t('common.unknownError')) },
});

export function setupInstallerHandlers(): void {
  ipcMain.on(
    'installer:run-decision',
    (_, gameId: string, decision: RunInstallerDecision) => {
      answerRunInstaller(gameId, decision);
    }
  );

  ipcMain.handle(
    'install-translation',
    async (_, game: Game, options: InstallOptions, customGamePath?: string) => {
      try {
        const installResult = await installTranslation(
          game,
          options,
          customGamePath,
          (downloadProgress) => {
            getMainWindow()?.webContents.send(
              'download-progress',
              game.id,
              downloadProgress
            );
          },
          (status) => {
            getMainWindow()?.webContents.send('installation-status', game.id, status);
          },
          (request) =>
            askRunInstaller(request, () => {
              const window = getMainWindow();
              if (!window || window.isDestroyed()) {
                return false;
              }
              window.webContents.send('installer:confirm-run', request);
              return true;
            })
        );

        // Note: cache invalidation and the installed-games-changed event
        // happen automatically via InstallationWatcher when files change
        // Download tracking now happens in the Edge Function when generating the signed URL

        // Locally increment downloads counter (broadcast is skipped for downloads-only changes).
        // The server counts unique downloads, so the worst case is +1 drift until next sync.
        if (options.installText) {
          try {
            const repo = GamesRepository.getInstance();
            repo.incrementDownloads(game.id);
            notifyCountersUpdated(repo.getGamesByIds([game.id]));
          } catch (err) {
            console.error('[Installer] Failed to update local downloads count:', err);
          }
        }

        const result: InstallResult = {
          success: true,
          launchOptionsQueued: installResult.launchOptionsQueued,
          launchOptionsError: installResult.launchOptionsError,
          eglLaunchOptionsNotes: installResult.eglLaunchOptionsNotes,
          achievementsDelivery: installResult.achievementsDelivery,
        };
        return result;
      } catch (error) {
        // Handle pause - not an error, just a state
        if (error instanceof PausedSignal) {
          return { success: false, paused: true };
        }
        console.error('Error installing translation:', error);
        // Return error info instead of throwing to preserve custom properties
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : t('common.unknownError'),
            needsManualSelection: error instanceof ManualSelectionError,
            isRateLimit: error instanceof RateLimitError,
            isNetworkError: error instanceof NetworkError,
          },
        };
      }
    }
  );

  handleOr(
    'apply-pending-launch-options',
    (game: Game): Promise<ApplyPendingLaunchOptionsResult> => applyLaunchOptionsNow(game),
    orFailure
  );

  handleOr('check-installation', (game: Game) => checkInstallation(game), orNull, {
    timed: true,
  });

  handleOr(
    'get-conflicting-translation',
    (game: Game) => getConflictingTranslation(game),
    orNull
  );

  handleOr(
    'set-game-visibility',
    ({ gameId, hidden }: { gameId: string; hidden: boolean }) => {
      const success = GamesRepository.getInstance().setGameVisibility(gameId, hidden);
      if (success) {
        appEvents.emit('catalog-changed');
      }
      return success;
    },
    () => false
  );

  handleOr('get-all-installed-game-ids', getAllInstalledGameIds, orEmpty);

  ipcMain.handle('open-external', async (_, url: string) => await openExternalUrl(url));

  handleOr(
    'show-item-in-folder',
    (filePath: string) => {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: t('installIpc.fileNotFound') };
      }
      shell.showItemInFolder(filePath);
      return { success: true };
    },
    orFailure
  );

  ipcMain.handle('select-game-folder', async () => {
    const lastFolder = readLastGameFolder();
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: t('installIpc.pickFolderTitle'),
      buttonLabel: t('installIpc.pickFolderButton'),
      defaultPath: lastFolder && path.dirname(lastFolder),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    writeLastGameFolder(result.filePaths[0]);
    return result.filePaths[0];
  });

  handleOr(
    'uninstall-translation',
    async (game: Game) => {
      await uninstallTranslation(game);
      trackUninstall(game.id).catch((err) => {
        console.error('[Installer] Failed to track uninstall:', err);
      });
      // The installation watcher sees the record go and tells the renderer
      return { success: true };
    },
    orFailureMessage
  );

  handleOr(
    'rerun-installer',
    async (installerPath: string, protonPath?: string) => {
      await rerunInstaller(installerPath, protonPath);
      return { success: true };
    },
    orFailureMessage
  );

  handleOr(
    'abort-download',
    (reason?: string) => {
      abortCurrentDownload(reason);
      return { success: true };
    },
    () => ({ success: false })
  );

  handleOr(
    'pause-download',
    (gameId: string) => {
      const state = pauseCurrentDownload(gameId);
      return state
        ? { success: true, state }
        : { success: false, error: t('installIpc.noActiveDownload') };
    },
    orFailure
  );

  handleOr(
    'resume-download',
    (gameId: string) => {
      const state = getPausedDownloadState(gameId);
      if (!state) {
        return { success: false, error: t('installIpc.noPausedDownload') };
      }
      // Runs in the background, reporting through the progress and status pushes
      resumeDownload(
        state,
        (downloadProgress) =>
          sendToRenderer('download-progress', gameId, downloadProgress),
        (status) => sendToRenderer('installation-status', gameId, status)
      ).catch((error) => {
        console.error('[Installer] Resumed download failed:', error);
        sendToRenderer('installation-status', gameId, {
          message: errorMessage(error, t('download.failed')),
          tone: 'error',
        });
      });
      return { success: true };
    },
    orFailure
  );

  handleOr(
    'get-paused-download',
    (gameId: string) => getPausedDownloadState(gameId),
    orNull
  );

  handleOr(
    'cancel-paused-download',
    (gameId: string) => {
      const state = getPausedDownloadState(gameId);
      const partialPath = state && getPartialFilePath(state.outputPath);
      if (partialPath && fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath);
      }
      clearPausedDownloadState(gameId);
      return { success: true };
    },
    orFailure
  );

  handleOr(
    'remove-orphaned-metadata',
    async (gameIds: string[]) => {
      await removeOrphanedInstallationMetadata(gameIds);
      return { success: true };
    },
    () => ({ success: false })
  );

  handleOr(
    'remove-components',
    async (
      game: Game,
      componentsToRemove: { voice?: boolean; achievements?: boolean }
    ) => {
      await removeComponents(game, componentsToRemove);
      return { success: true };
    },
    orFailureMessage
  );

  handleOr(
    'set-steam-artwork',
    async (game: Game, enabled: boolean): Promise<SteamArtworkChangeResult> => {
      const result = await setInstalledSteamArtwork(game, enabled, (status) =>
        sendToRenderer('installation-status', game.id, status)
      );
      if (!result.success) {
        console.warn(
          `[Installer] Steam artwork not changed for ${game.id}: ${result.error}`
        );
      }
      return result;
    },
    (error): SteamArtworkChangeResult => ({ success: false, error: errorMessage(error) })
  );

  ipcMain.handle('is-steam-artwork-applied', (_, appId: number) =>
    hasSteamArtwork(appId)
  );

  ipcMain.handle('check-platform-compatibility', async (_, game: Game) =>
    checkPlatformCompatibility(game)
  );
}
