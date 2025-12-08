import { app, session } from 'electron';

// Steam Deck / Gaming Mode support
// Disable GPU sandbox to prevent issues with Gamescope
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
  // Enable gamepad support
  app.commandLine.appendSwitch('enable-gamepad-extensions');
}
import { createMainWindow, getMainWindow } from './window';
import { setupWindowControls, initTray } from './ipc/window-controls';
import { setupGamesHandlers } from './ipc/games';
import { setupInstallerHandlers } from './ipc/installer';
import { setupAutoUpdater, checkForUpdates } from './auto-updater';
import { startSteamWatcher, stopSteamWatcher } from './steam-watcher';
import { startInstallationWatcher, stopInstallationWatcher } from './installation-watcher';
import { initDatabase, closeDatabase } from './db/database';
import { SyncManager } from './db/sync-manager';
import { fetchAllGamesFromSupabase, fetchUpdatedGamesFromSupabase } from './db/supabase-sync-api';
import { SupabaseRealtimeManager } from './db/supabase-realtime';

// Глобальні менеджери
let syncManager: SyncManager | null = null;
let realtimeManager: SupabaseRealtimeManager | null = null;

// Single instance lock - prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // When someone tries to run a second instance, focus our window instead
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // Setup all IPC handlers
  setupWindowControls();
  setupGamesHandlers();
  setupInstallerHandlers();
  setupAutoUpdater();

  // App lifecycle
  app.whenReady().then(async () => {
    // Ініціалізувати локальну базу даних
    console.log('[Main] Initializing local database...');
    initDatabase();

    // Запустити синхронізацію
    console.log('[Main] Starting sync with Supabase...');
    syncManager = new SyncManager();

    try {
      await syncManager.sync(
        fetchAllGamesFromSupabase,
        fetchUpdatedGamesFromSupabase
      );
      console.log('[Main] Initial sync completed');
    } catch (error) {
      console.error('[Main] Error during initial sync:', error);
    }

    // Підписатися на realtime оновлення з Supabase
    console.log('[Main] Setting up realtime subscription...');
    realtimeManager = new SupabaseRealtimeManager();
    realtimeManager.subscribe(
      (game) => {
        // Оновити локальну БД через SyncManager
        syncManager?.handleRealtimeUpdate(game);
      },
      (gameId) => {
        // Видалити з локальної БД через SyncManager
        syncManager?.handleRealtimeDelete(gameId);
      }
    );

    // Fix YouTube error 153 by setting Referer header for YouTube requests
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.includes('youtube.com') || details.url.includes('youtube-nocookie.com')) {
        details.requestHeaders['Referer'] = 'https://littlebitua.github.io/';
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    createMainWindow();
    initTray(); // Створити tray одразу при запуску
    checkForUpdates();

    // Start watching Steam library for changes (after a short delay to ensure window is ready)
    setTimeout(() => {
      startSteamWatcher(getMainWindow());
      startInstallationWatcher(getMainWindow());
    }, 1000);

    app.on('activate', () => {
      // macOS: показати вікно якщо воно заховане або створити нове якщо немає
      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // Cleanup
    stopSteamWatcher();
    stopInstallationWatcher();

    // Відписатися від realtime оновлень
    realtimeManager?.unsubscribe();

    // Закрити базу даних
    closeDatabase();

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
