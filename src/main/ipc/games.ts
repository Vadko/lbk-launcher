import { app, ipcMain } from 'electron';
import type { Game, GetGamesParams } from '../../shared/types';
import {
  countGamesBySteamAppIds,
  fetchFilterCounts,
  fetchGames,
  fetchGamesByIds,
  fetchTeams,
  findGamesByInstallPaths,
  findGamesBySteamAppIds,
} from '../api';
import { fetchTrendingGames } from '../db/supabase-sync-api';
import {
  getAllInstalledGamePaths,
  getAllInstalledSteamGames,
  getFirstAvailableGamePath,
  getSteamLibraryAppIds,
} from '../game-detector';
import { syncKurinGames } from '../game-detector/kurin';
import { findProtons } from '../installer/proton';
import { getMachineId, trackSubscription, trackSupportClick } from '../tracking';
import { createTimer } from '../utils/logger';
import { getPlatform } from '../utils/platform';
import { launchSteamGame, restartSteam } from '../utils/steam-launcher';

export function setupGamesHandlers(): void {
  // Version
  ipcMain.on('get-version', (event) => {
    event.returnValue = app.getVersion();
  });

  // Platform
  ipcMain.on('get-platform', (event) => {
    event.returnValue = getPlatform();
  });

  // Machine ID - for subscription tracking
  ipcMain.handle('get-machine-id', () => getMachineId());

  // Track subscription (subscribe/unsubscribe) from renderer
  ipcMain.handle(
    'track-subscription',
    async (_, gameId: string, action: 'subscribe' | 'unsubscribe') =>
      trackSubscription(gameId, action)
  );

  // Track support click
  ipcMain.handle('track-support-click', async (_, gameId: string) =>
    trackSupportClick(gameId)
  );

  // Fetch games with pagination - SYNC тепер, тому що локальна БД
  ipcMain.handle('fetch-games', (_, params: GetGamesParams) => {
    const timer = createTimer('IPC: fetch-games');
    try {
      const result = fetchGames(params);
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error fetching games:', error);
      return { games: [], total: 0, hasMore: false };
    }
  });

  // Fetch games by IDs - SYNC
  ipcMain.handle(
    'fetch-games-by-ids',
    (_, gameIds: string[], searchQuery?: string, hideAiTranslations = false) => {
      try {
        return fetchGamesByIds(gameIds, searchQuery, hideAiTranslations);
      } catch (error) {
        console.error('Error fetching games by IDs:', error);
        return [];
      }
    }
  );

  // Fetch unique teams - SYNC
  ipcMain.handle('fetch-teams', () => {
    try {
      return fetchTeams();
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  });

  // Fetch filter counts - SYNC (efficient SQL aggregation)
  ipcMain.handle('fetch-filter-counts', () => {
    try {
      return fetchFilterCounts();
    } catch (error) {
      console.error('Error fetching filter counts:', error);
      return {
        planned: 0,
        'in-progress': 0,
        completed: 0,
        'with-achievements': 0,
        'with-voice': 0,
      };
    }
  });

  // Fetch trending games with download counts
  ipcMain.handle('fetch-trending-games', async (_, days = 30, limit = 10) => {
    try {
      return await fetchTrendingGames(days, limit);
    } catch (error) {
      console.error('Error fetching trending games:', error);
      return [];
    }
  });

  // Sync Kurin installed games data
  ipcMain.handle('sync-kurin-games', async () => {
    try {
      return syncKurinGames();
    } catch (error) {
      console.error('Error sync kurin games:', error);
      return [];
    }
  });

  // Get all installed game paths from the system
  ipcMain.handle('get-all-installed-game-paths', async () => {
    const timer = createTimer('IPC: get-all-installed-game-paths');
    try {
      const result = getAllInstalledGamePaths();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error getting installed game paths:', error);
      return [];
    }
  });

  // Get all installed Steam games
  ipcMain.handle('get-all-installed-steam-games', async () => {
    const timer = createTimer('IPC: get-all-installed-steam-games');
    try {
      const steamGames = getAllInstalledSteamGames();
      // Convert Map to Object for IPC
      timer.end();
      return Object.fromEntries(steamGames);
    } catch (error) {
      timer.end();
      console.error('Error getting installed Steam games:', error);
      return {};
    }
  });

  // Get all installed Protons
  ipcMain.handle('get-available-protons', async () => {
    try {
      return findProtons();
    } catch (error) {
      console.error('Error getting available Protons:', error);
      return [];
    }
  });

  // Find games by install paths - SYNC
  ipcMain.handle(
    'find-games-by-install-paths',
    (_, installPaths: string[], searchQuery?: string, hideAiTranslations = false) => {
      try {
        return findGamesByInstallPaths(installPaths, searchQuery, hideAiTranslations);
      } catch (error) {
        console.error('Error finding games by install paths:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Get Steam library App IDs (owned games, installed or not)
  ipcMain.handle('get-steam-library-app-ids', async () => {
    const timer = createTimer('IPC: get-steam-library-app-ids');
    try {
      const result = await getSteamLibraryAppIds();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error getting Steam library App IDs:', error);
      return [];
    }
  });

  // Find games by Steam App IDs
  ipcMain.handle(
    'find-games-by-steam-app-ids',
    (_, steamAppIds: number[], searchQuery?: string, hideAiTranslations = false) => {
      try {
        return findGamesBySteamAppIds(steamAppIds, searchQuery, hideAiTranslations);
      } catch (error) {
        console.error('Error finding games by Steam App IDs:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Count games by Steam App IDs
  ipcMain.handle('count-games-by-steam-app-ids', (_, steamAppIds: number[]) => {
    try {
      return countGamesBySteamAppIds(steamAppIds);
    } catch (error) {
      console.error('Error counting games by Steam App IDs:', error);
      return 0;
    }
  });

  // Launch game
  ipcMain.handle('launch-game', async (_, game: Game) => {
    try {
      console.log('[LaunchGame] Request to launch game:', game.name, '(', game.id, ')');
      console.log(
        '[LaunchGame] Game install paths:',
        JSON.stringify(game.install_paths, null, 2)
      );

      const gamePath = getFirstAvailableGamePath(game.install_paths || []);

      if (!gamePath || !gamePath.exists) {
        console.error('[LaunchGame] Game not found on system');
        return {
          success: false,
          error: "Гру не знайдено на вашому комп'ютері",
        };
      }

      console.log(
        '[LaunchGame] Launching game:',
        game.name,
        'at',
        gamePath.path,
        'platform:',
        gamePath.platform
      );

      // For Steam games, try to launch via Steam protocol
      if (gamePath.platform === 'steam') {
        const { findSteamAppId } = await import('../game-launcher');
        const appId = await findSteamAppId(gamePath.path);

        if (appId) {
          const result = await launchSteamGame(appId);
          if (result.success) {
            return { success: true };
          }
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

  // Restart Steam
  ipcMain.handle('restart-steam', () => restartSteam());
}
