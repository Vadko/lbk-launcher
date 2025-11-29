import { app, ipcMain, Notification } from 'electron';
import { fetchGames } from '../api';
import { subscribeToGameUpdates } from '../../lib/api';
import { getMainWindow } from '../window';

let unsubscribeRealtime: (() => void) | null = null;

export function setupGamesHandlers(): void {
  // Version
  ipcMain.on('get-version', (event) => {
    event.returnValue = app.getVersion();
  });

  // Fetch games
  ipcMain.handle('fetch-games', async () => {
    try {
      return await fetchGames();
    } catch (error) {
      console.error('Error fetching games:', error);
      return [];
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
}

export function cleanupGamesHandlers(): void {
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }
}
