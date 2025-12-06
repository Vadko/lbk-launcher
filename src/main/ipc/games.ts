import { app, ipcMain, Notification } from 'electron';
import { fetchGames, fetchGamesByIds, findGamesByInstallPaths } from '../api';
import { subscribeToGameUpdates } from '../../lib/api';
import { getMainWindow } from '../window';
import { GetGamesParams, Game } from '../../shared/types';
import { getFirstAvailableGamePath, getAllInstalledGamePaths, getAllInstalledSteamGames } from '../game-detector';

let unsubscribeRealtime: (() => void) | null = null;

export function setupGamesHandlers(): void {
  // Version
  ipcMain.on('get-version', (event) => {
    event.returnValue = app.getVersion();
  });

  // Fetch games with pagination
  ipcMain.handle('fetch-games', async (_, params: GetGamesParams) => {
    try {
      return await fetchGames(params);
    } catch (error) {
      console.error('Error fetching games:', error);
      return { games: [], total: 0, hasMore: false };
    }
  });

  // Fetch games by IDs
  ipcMain.handle('fetch-games-by-ids', async (_, gameIds: string[]) => {
    try {
      return await fetchGamesByIds(gameIds);
    } catch (error) {
      console.error('Error fetching games by IDs:', error);
      return [];
    }
  });

  // Get all installed game paths from the system
  ipcMain.handle('get-all-installed-game-paths', async () => {
    try {
      return getAllInstalledGamePaths();
    } catch (error) {
      console.error('Error getting installed game paths:', error);
      return [];
    }
  });

  // Get all installed Steam games
  ipcMain.handle('get-all-installed-steam-games', async () => {
    try {
      const steamGames = getAllInstalledSteamGames();
      // Convert Map to Object for IPC
      return Object.fromEntries(steamGames);
    } catch (error) {
      console.error('Error getting installed Steam games:', error);
      return {};
    }
  });

  // Find games by install paths
  ipcMain.handle('find-games-by-install-paths', async (_, installPaths: string[], offset?: number, limit?: number) => {
    try {
      return await findGamesByInstallPaths(installPaths, offset, limit);
    } catch (error) {
      console.error('Error finding games by install paths:', error);
      return { games: [], total: 0, hasMore: false };
    }
  });

  // Subscribe to real-time updates
  ipcMain.handle('subscribe-game-updates', () => {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
    }

    unsubscribeRealtime = subscribeToGameUpdates((updatedGame) => {
      getMainWindow()?.webContents.send('game-updated', updatedGame);
    });

    return { success: true };
  });

  // Unsubscribe from real-time updates
  ipcMain.handle('unsubscribe-game-updates', () => {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
    return { success: true };
  });

  // Show game update notification
  ipcMain.on('show-game-update-notification', (_, gameName: string, version: string, isInitialLoad: boolean) => {
    // Skip system notification during initial load
    if (!isInitialLoad) {
      const notification = new Notification({
        title: 'Доступне оновлення перекладу',
        body: `Нова версія перекладу для ${gameName} (${version})`,
        silent: false,
      });

      notification.show();
    }

    // Always send in-app notification
    getMainWindow()?.webContents.send('game-update-available', {
      gameName,
      version,
    });
  });

  // Launch game
  ipcMain.handle('launch-game', async (_, game: Game) => {
    try {
      console.log('[LaunchGame] Request to launch game:', game.name, '(', game.id, ')');
      console.log('[LaunchGame] Game install paths:', JSON.stringify(game.install_paths, null, 2));

      const gamePath = getFirstAvailableGamePath(game.install_paths || []);

      if (!gamePath || !gamePath.exists) {
        console.error('[LaunchGame] Game not found on system');
        return {
          success: false,
          error: 'Гру не знайдено на вашому комп\'ютері',
        };
      }

      console.log('[LaunchGame] Launching game:', game.name, 'at', gamePath.path, 'platform:', gamePath.platform);

      // For Steam games, try to launch via Steam protocol
      if (gamePath.platform === 'steam') {
        // Try to find Steam App ID from the game path
        const { findSteamAppId } = await import('../game-launcher');
        const appId = await findSteamAppId(gamePath.path);

        if (appId) {
          console.log('[LaunchGame] Launching via Steam protocol with App ID:', appId);
          const { shell } = await import('electron');
          await shell.openExternal(`steam://rungameid/${appId}`);
          return { success: true };
        }
      }

      // Fallback: launch executable directly
      const { launchGameExecutable } = await import('../game-launcher');
      await launchGameExecutable(gamePath.path);

      return { success: true };
    } catch (error) {
      console.error('[LaunchGame] Error launching game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Не вдалося запустити гру',
      };
    }
  });
}

export function cleanupGamesHandlers(): void {
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }
}
