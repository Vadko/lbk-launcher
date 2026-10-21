import { dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { ApplyPendingLaunchOptionsResult } from '../../shared/plugin-host-types';
import type {
  Game,
  InstallOptions,
  InstallResult,
  RunInstallerDecision,
} from '../../shared/types';
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
import { removeComponents, uninstallTranslation } from '../installer/uninstall';
import { applyLaunchOptionsNow } from '../steam-restart';
import { trackUninstall } from '../tracking';
import { createTimer } from '../utils/logger';
import { openExternalUrl } from '../utils/open-external';
import { readLastGameFolder, writeLastGameFolder } from '../utils/store-storage';
import { getMainWindow } from '../window';

// Resolvers for run-installer confirmations awaiting a decision from the renderer,
// keyed by game id (one pending install per game at a time).
const pendingRunInstallerDecisions = new Map<
  string,
  (decision: RunInstallerDecision) => void
>();

export function setupInstallerHandlers(): void {
  ipcMain.on(
    'installer:run-decision',
    (_, gameId: string, decision: RunInstallerDecision) => {
      const resolve = pendingRunInstallerDecisions.get(gameId);
      if (resolve) {
        pendingRunInstallerDecisions.delete(gameId);
        resolve(decision);
      }
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
            new Promise<RunInstallerDecision>((resolve) => {
              pendingRunInstallerDecisions.set(request.gameId, resolve);
              getMainWindow()?.webContents.send('installer:confirm-run', request);
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
            const updatedGame = repo.getGameById(game.id);
            if (updatedGame) {
              getMainWindow()?.webContents.send('game-counters-updated', [updatedGame]);
            }
          } catch (err) {
            console.error('[Installer] Failed to update local downloads count:', err);
          }
        }

        const result: InstallResult = {
          success: true,
          launchOptionsQueued: installResult.launchOptionsQueued,
          launchOptionsError: installResult.launchOptionsError,
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

  ipcMain.handle(
    'apply-pending-launch-options',
    async (_, game: Game): Promise<ApplyPendingLaunchOptionsResult> => {
      try {
        return await applyLaunchOptionsNow(game);
      } catch (error) {
        console.error('[Installer] Applying pending launch options failed:', error);
        return {
          success: false,
          error: errorMessage(error, t('common.unknownError')),
        };
      }
    }
  );

  ipcMain.handle('check-installation', async (_, game: Game) => {
    const timer = createTimer(`IPC: check-installation (${game.name})`);
    try {
      const result = await checkInstallation(game);
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error checking installation:', error);
      return null;
    }
  });

  ipcMain.handle('get-conflicting-translation', async (_, game: Game) => {
    try {
      return await getConflictingTranslation(game);
    } catch (error) {
      console.error('Error checking conflicting translation:', error);
      return null;
    }
  });

  ipcMain.handle('set-game-visibility', async (_, { gameId, hidden }) => {
    try {
      const repo = GamesRepository.getInstance();
      const success = await repo.setGameVisibility(gameId, hidden);
      return success;
    } catch (error) {
      console.error('[IPC] set-game-visibility failed:', error);
      return false;
    }
  });

  ipcMain.handle('get-all-installed-game-ids', async () => {
    try {
      return await getAllInstalledGameIds();
    } catch (error) {
      console.error('Error getting installed game IDs:', error);
      return [];
    }
  });

  ipcMain.handle('open-external', async (_, url: string) => await openExternalUrl(url));

  ipcMain.handle('show-item-in-folder', async (_, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: t('installIpc.fileNotFound') };
      }
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error showing item in folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t('common.unknownError'),
      };
    }
  });

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

  ipcMain.handle('uninstall-translation', async (_, game: Game) => {
    try {
      await uninstallTranslation(game);

      // Track uninstall for statistics
      trackUninstall(game.id).catch((err) => {
        console.error('[Installer] Failed to track uninstall:', err);
      });

      // Note: cache invalidation and the installed-games-changed event
      // happen automatically via InstallationWatcher when files change

      return { success: true };
    } catch (error) {
      console.error('Error uninstalling translation:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : t('common.unknownError'),
        },
      };
    }
  });

  ipcMain.handle(
    'rerun-installer',
    async (_, installerPath: string, protonPath?: string) => {
      try {
        await rerunInstaller(installerPath, protonPath);
        return { success: true };
      } catch (error) {
        console.error('Error re-running installer:', error);
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : t('common.unknownError'),
          },
        };
      }
    }
  );

  ipcMain.handle('abort-download', async (_, reason?: string) => {
    try {
      abortCurrentDownload(reason);
      return { success: true };
    } catch (error) {
      console.error('Error aborting download:', error);
      return { success: false };
    }
  });

  ipcMain.handle('pause-download', async (_, gameId: string) => {
    try {
      const state = pauseCurrentDownload(gameId);
      if (state) {
        return { success: true, state };
      }
      return { success: false, error: t('installIpc.noActiveDownload') };
    } catch (error) {
      console.error('Error pausing download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t('common.unknownError'),
      };
    }
  });

  ipcMain.handle('resume-download', async (_, gameId: string) => {
    try {
      const state = getPausedDownloadState(gameId);
      if (!state) {
        return { success: false, error: t('installIpc.noPausedDownload') };
      }

      // Resume download in background
      resumeDownload(
        state,
        (downloadProgress) => {
          getMainWindow()?.webContents.send(
            'download-progress',
            gameId,
            downloadProgress
          );
        },
        (status) => {
          getMainWindow()?.webContents.send('installation-status', gameId, status);
        }
      ).catch((error) => {
        console.error('Error during resumed download:', error);
        getMainWindow()?.webContents.send('installation-status', gameId, {
          message: error instanceof Error ? error.message : t('download.failed'),
          tone: 'error',
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Error resuming download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t('common.unknownError'),
      };
    }
  });

  ipcMain.handle('get-paused-download', async (_, gameId: string) => {
    try {
      return getPausedDownloadState(gameId);
    } catch (error) {
      console.error('Error getting paused download:', error);
      return null;
    }
  });

  ipcMain.handle('cancel-paused-download', async (_, gameId: string) => {
    try {
      const state = getPausedDownloadState(gameId);
      if (state) {
        // Clean up partial file
        const partialPath = getPartialFilePath(state.outputPath);
        if (fs.existsSync(partialPath)) {
          fs.unlinkSync(partialPath);
        }
      }
      clearPausedDownloadState(gameId);
      return { success: true };
    } catch (error) {
      console.error('Error cancelling paused download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t('common.unknownError'),
      };
    }
  });

  ipcMain.handle('remove-orphaned-metadata', async (_, gameIds: string[]) => {
    try {
      await removeOrphanedInstallationMetadata(gameIds);
      return { success: true };
    } catch (error) {
      console.error('Error removing orphaned metadata:', error);
      return { success: false };
    }
  });

  ipcMain.handle(
    'remove-components',
    async (
      _,
      game: Game,
      componentsToRemove: { voice?: boolean; achievements?: boolean }
    ) => {
      try {
        await removeComponents(game, componentsToRemove);
        return { success: true };
      } catch (error) {
        console.error('Error removing components:', error);
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : t('common.unknownError'),
          },
        };
      }
    }
  );

  ipcMain.handle('check-platform-compatibility', async (_, game: Game) =>
    checkPlatformCompatibility(game)
  );
}
