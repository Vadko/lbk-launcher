import { app, ipcMain, shell } from 'electron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { fetchGames, fetchGamesByIds, findGamesByInstallPaths, fetchTeams } from '../api';
import type { GetGamesParams, Game } from '../../shared/types';
import {
  getFirstAvailableGamePath,
  getAllInstalledGamePaths,
  getAllInstalledSteamGames,
} from '../game-detector';
import { getMachineId, trackSubscription } from '../tracking';

const execAsync = promisify(exec);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function setupGamesHandlers(): void {
  // Version
  ipcMain.on('get-version', (event) => {
    event.returnValue = app.getVersion();
  });

  // Machine ID - for subscription tracking
  ipcMain.handle('get-machine-id', () => getMachineId());

  // Track subscription (subscribe/unsubscribe) from renderer
  ipcMain.handle(
    'track-subscription',
    async (_, gameId: string, action: 'subscribe' | 'unsubscribe') =>
      trackSubscription(gameId, action)
  );

  // Fetch games with pagination - SYNC тепер, тому що локальна БД
  ipcMain.handle('fetch-games', (_, params: GetGamesParams) => {
    try {
      return fetchGames(params);
    } catch (error) {
      console.error('Error fetching games:', error);
      return { games: [], total: 0, hasMore: false };
    }
  });

  // Fetch games by IDs - SYNC
  ipcMain.handle('fetch-games-by-ids', (_, gameIds: string[]) => {
    try {
      return fetchGamesByIds(gameIds);
    } catch (error) {
      console.error('Error fetching games by IDs:', error);
      return [];
    }
  });

  // Fetch unique teams - SYNC
  ipcMain.handle('fetch-teams', () => {
    try {
      return fetchTeams();
    } catch (error) {
      console.error('Error fetching teams:', error);
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

  // Find games by install paths - SYNC
  ipcMain.handle('find-games-by-install-paths', (_, installPaths: string[]) => {
    try {
      return findGamesByInstallPaths(installPaths);
    } catch (error) {
      console.error('Error finding games by install paths:', error);
      return { games: [], total: 0 };
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
        // Try to find Steam App ID from the game path
        const { findSteamAppId } = await import('../game-launcher');
        const appId = await findSteamAppId(gamePath.path);

        if (appId) {
          console.log('[LaunchGame] Launching via Steam protocol with App ID:', appId);
          const { isLinux } = await import('../utils/platform');

          if (isLinux()) {
            // On Linux, detect Steam installation type and use appropriate command
            const { spawn } = await import('child_process');
            const { existsSync } = await import('fs');
            const { homedir } = await import('os');
            const steamUrl = `steam://rungameid/${appId}`;

            // Detect Steam installation type
            const home = homedir();
            const isFlatpak = existsSync(`${home}/.var/app/com.valvesoftware.Steam`);
            const isSnap = existsSync(`${home}/snap/steam`);

            let launched = false;

            if (isFlatpak) {
              // Flatpak Steam
              console.log('[LaunchGame] Detected Flatpak Steam installation');
              try {
                spawn('flatpak', ['run', 'com.valvesoftware.Steam', steamUrl], {
                  detached: true,
                  stdio: 'ignore',
                }).unref();
                launched = true;
              } catch (err) {
                console.warn('[LaunchGame] Flatpak Steam launch failed:', err);
              }
            } else if (isSnap) {
              // Snap Steam
              console.log('[LaunchGame] Detected Snap Steam installation');
              try {
                spawn('snap', ['run', 'steam', steamUrl], {
                  detached: true,
                  stdio: 'ignore',
                }).unref();
                launched = true;
              } catch (err) {
                console.warn('[LaunchGame] Snap Steam launch failed:', err);
              }
            }

            // Try native steam command
            if (!launched) {
              console.log('[LaunchGame] Trying native Steam command');
              try {
                spawn('steam', [steamUrl], {
                  detached: true,
                  stdio: 'ignore',
                }).unref();
                launched = true;
              } catch (err) {
                console.warn('[LaunchGame] Native Steam command failed:', err);
              }
            }

            // Fallback to xdg-open
            if (!launched) {
              console.log('[LaunchGame] Trying xdg-open fallback');
              try {
                spawn('xdg-open', [steamUrl], {
                  detached: true,
                  stdio: 'ignore',
                }).unref();
                launched = true;
              } catch (err) {
                console.warn('[LaunchGame] xdg-open failed:', err);
              }
            }

            if (launched) {
              return { success: true };
            }
          } else {
            // On Windows/macOS, use shell.openExternal
            const { shell } = await import('electron');
            await shell.openExternal(`steam://rungameid/${appId}`);
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
  ipcMain.handle('restart-steam', async () => {
    console.log('[Steam] Restarting Steam...');

    try {
      switch (process.platform) {
        case 'win32':
          await execAsync('taskkill /F /IM steam.exe').catch((e) => {
            console.log('[Steam] Steam process not found or already closed:', e.message);
          });
          await delay(1000);
          await shell.openExternal('steam://');
          break;

        case 'linux':
          await execAsync('pkill -TERM steam').catch((e) => {
            console.log('[Steam] Steam process not found or already closed:', e.message);
          });
          await delay(2000);
          spawn('steam', [], { detached: true, stdio: 'ignore' }).unref();
          break;

        case 'darwin':
          await execAsync('pkill -f Steam').catch((e) => {
            console.log('[Steam] Steam process not found or already closed:', e.message);
          });
          await delay(1000);
          await shell.openExternal('steam://');
          break;
      }

      console.log('[Steam] Steam restart initiated');
      return { success: true };
    } catch (error) {
      console.error('[Steam] Failed to restart Steam:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
