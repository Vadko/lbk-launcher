import { dialog, ipcMain } from 'electron';
import fs from 'fs';
import type { Game, InstallOptions } from '../../shared/types';
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
import { trackUninstall } from '../tracking';
import { createTimer } from '../utils/logger';
import { openExternalUrl } from '../utils/open-external';
import { writeSteamLaunchOptions } from '../utils/steam-launch-options';
import { launchSteam, shutdownSteam } from '../utils/steam-launcher';
import { getMainWindow } from '../window';

export function setupInstallerHandlers(): void {
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
          }
        );

        // Note: cache invalidation та installed-games-changed event
        // автоматично відбуваються через InstallationWatcher при зміні файлів
        // Download tracking тепер відбувається в Edge Function при генерації signed URL

        // Locally increment downloads counter (broadcast is skipped for downloads-only changes).
        // The server counts unique downloads, so the worst case is +1 drift until next sync.
        if (options.installText) {
          try {
            const repo = GamesRepository.getInstance();
            repo.incrementDownloads(game.id);
            const updatedGame = repo.getGameById(game.id);
            if (updatedGame) {
              getMainWindow()?.webContents.send('game-updated', updatedGame);
            }
          } catch (err) {
            console.error('[Installer] Failed to update local downloads count:', err);
          }
        }

        return {
          success: true,
          launchOptionsPending: installResult.launchOptionsPending,
          achievementsChanged: installResult.achievementsChanged,
        };
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
            message: error instanceof Error ? error.message : 'Невідома помилка',
            needsManualSelection: error instanceof ManualSelectionError,
            isRateLimit: error instanceof RateLimitError,
            isNetworkError: error instanceof NetworkError,
          },
        };
      }
    }
  );

  /**
   * Restart Steam and apply launch options in the gap. Used when a translation
   * needs launch options but CEF was unreachable at install time (typically
   * Millennium-modded Steam). Order matters: Steam must be off before we
   * touch localconfig.vdf, or it overwrites our changes on graceful exit.
   */
  ipcMain.handle('apply-pending-launch-options', async (_, game: Game) => {
    try {
      if (!game.steam_app_id) {
        return { success: false, error: 'Гра не має Steam App ID' };
      }
      await shutdownSteam();
      const result = await writeSteamLaunchOptions({
        appId: game.steam_app_id,
        windowsOptions: game.steam_launch_options_windows,
        linuxOptions: game.steam_launch_options_linux,
      });
      console.log(
        `[Installer] Apply pending launch options mode=${result.mode}${result.reason ? ` — ${result.reason}` : ''}`
      );
      await launchSteam();
      return { success: result.mode === 'file' || result.mode === 'noop' };
    } catch (error) {
      console.error('Error applying pending launch options:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Невідома помилка',
      };
    }
  });

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

  ipcMain.handle('open-external', async (_, url: string) => {
    try {
      await openExternalUrl(url);
      return { success: true };
    } catch (error) {
      console.error('[IPC] open-external failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('select-game-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Виберіть папку з грою',
      buttonLabel: 'Вибрати',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('uninstall-translation', async (_, game: Game) => {
    try {
      await uninstallTranslation(game);

      // Track uninstall for statistics
      trackUninstall(game.id).catch((err) => {
        console.error('[Installer] Failed to track uninstall:', err);
      });

      // Note: cache invalidation та installed-games-changed event
      // автоматично відбуваються через InstallationWatcher при зміні файлів

      return { success: true };
    } catch (error) {
      console.error('Error uninstalling translation:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Невідома помилка',
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
            message: error instanceof Error ? error.message : 'Невідома помилка',
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
      return { success: false, error: 'Немає активного завантаження для призупинення' };
    } catch (error) {
      console.error('Error pausing download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Невідома помилка',
      };
    }
  });

  ipcMain.handle('resume-download', async (_, gameId: string) => {
    try {
      const state = getPausedDownloadState(gameId);
      if (!state) {
        return { success: false, error: 'Немає призупиненого завантаження' };
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
        getMainWindow()?.webContents.send('installation-status', {
          message: `❌ ${error instanceof Error ? error.message : 'Помилка завантаження'}`,
        });
      });

      return { success: true };
    } catch (error) {
      console.error('Error resuming download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Невідома помилка',
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
        error: error instanceof Error ? error.message : 'Невідома помилка',
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
            message: error instanceof Error ? error.message : 'Невідома помилка',
          },
        };
      }
    }
  );

  ipcMain.handle('check-platform-compatibility', async (_, game: Game) =>
    checkPlatformCompatibility(game)
  );
}
