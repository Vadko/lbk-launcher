import { app, session, ipcMain } from 'electron';
import { isLinux, isMacOS, isWindows } from './utils/platform';
import { initLogger } from './utils/logger';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

// Deep link handling
const PROTOCOL = 'lbk';
let pendingDeepLink: string | null = null;

// Parse deep link URL: lbk://games/{slug}/{team}
function parseDeepLink(url: string): { slug: string; team: string } | null {
  try {
    // URL format: lbk://games/{slug}/{team}
    const urlObj = new URL(url);
    if (urlObj.protocol !== `${PROTOCOL}:`) return null;

    const pathParts = urlObj.pathname.replace(/^\/+/, '').split('/');
    // pathParts: ['games', 'slug', 'team'] or hostname might be 'games'

    // Handle both lbk://games/slug/team and lbk:///games/slug/team
    let parts: string[];
    if (urlObj.hostname === 'games') {
      // lbk://games/slug/team -> hostname='games', pathname='/slug/team'
      parts = ['games', ...pathParts];
    } else if (pathParts[0] === 'games') {
      // lbk:///games/slug/team -> pathname='/games/slug/team'
      parts = pathParts;
    } else {
      return null;
    }

    if (parts.length >= 3 && parts[0] === 'games') {
      return {
        slug: decodeURIComponent(parts[1]),
        team: decodeURIComponent(parts[2]),
      };
    }
    return null;
  } catch (error) {
    console.error('[DeepLink] Failed to parse URL:', url, error);
    return null;
  }
}

function handleDeepLink(url: string) {
  console.log('[DeepLink] Received URL:', url);
  const parsed = parseDeepLink(url);
  if (parsed) {
    console.log('[DeepLink] Parsed:', parsed);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('deep-link', parsed);
    } else {
      // Window not ready yet, save for later
      pendingDeepLink = url;
    }
  }
}

// Steam Deck / Gaming Mode support
// Disable GPU sandbox to prevent issues with Gamescope
if (isLinux()) {
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
import {
  startInstallationWatcher,
  stopInstallationWatcher,
} from './installation-watcher';
import { initDatabase, closeDatabase } from './db/database';
import { SyncManager } from './db/sync-manager';
import {
  fetchAllGamesFromSupabase,
  fetchUpdatedGamesFromSupabase,
  fetchDeletedGameIdsFromSupabase,
} from './db/supabase-sync-api';
import { SupabaseRealtimeManager } from './db/supabase-realtime';

// Глобальні менеджери
let syncManager: SyncManager | null = null;
let realtimeManager: SupabaseRealtimeManager | null = null;
let currentSyncStatus: 'syncing' | 'ready' | 'error' = 'syncing';

// Single instance lock - prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Initialize logger early to capture all logs
  initLogger();

  // Register protocol handler (for development, include the path to electron)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // macOS: Handle open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Windows/Linux: Handle second-instance with deep link URL in argv
  app.on('second-instance', (_event, argv) => {
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

    // On Windows/Linux, the deep link URL is passed as the last argument
    if (isWindows() || isLinux()) {
      const deepLinkUrl = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
      if (deepLinkUrl) {
        handleDeepLink(deepLinkUrl);
      }
    }
  });

  // Setup all IPC handlers
  setupWindowControls();
  setupGamesHandlers();
  setupInstallerHandlers();
  setupAutoUpdater();

  // IPC handler for getting current sync status
  ipcMain.handle('get-sync-status', () => currentSyncStatus);

  // App lifecycle
  app.whenReady().then(async () => {
    // Install React DevTools in development
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      try {
        const name = await installExtension(REACT_DEVELOPER_TOOLS);
        console.log(`[DevTools] Installed: ${name}`);
      } catch (err) {
        console.error('[DevTools] Failed to install extension:', err);
      }
    }

    // Ініціалізувати локальну базу даних
    console.log('[Main] Initializing local database...');
    initDatabase();

    // Fix YouTube error 153 by setting Referer header for YouTube requests
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (
        details.url.includes('youtube.com') ||
        details.url.includes('youtube-nocookie.com')
      ) {
        details.requestHeaders['Referer'] = 'http://127.0.0.1:5500/';
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    // Створити вікно ПЕРЕД синхронізацією, щоб показати лоадер
    await createMainWindow();
    initTray();

    // Відправити статус синхронізації в renderer
    const sendSyncStatus = (status: 'syncing' | 'ready' | 'error') => {
      currentSyncStatus = status;
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status', status);
      }
    };

    // Запустити синхронізацію (вікно вже відкрите, показує лоадер)
    console.log('[Main] Starting sync with Supabase...');
    syncManager = new SyncManager();

    try {
      sendSyncStatus('syncing');
      await syncManager.sync(
        fetchAllGamesFromSupabase,
        fetchUpdatedGamesFromSupabase,
        fetchDeletedGameIdsFromSupabase
      );
      console.log('[Main] Initial sync completed');
      sendSyncStatus('ready');
    } catch (error) {
      console.error('[Main] Error during initial sync:', error);
      sendSyncStatus('error');
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

    checkForUpdates();

    // Handle pending deep link if app was opened via protocol
    if (pendingDeepLink) {
      handleDeepLink(pendingDeepLink);
      pendingDeepLink = null;
    }

    // Check for deep link in process args (Windows/Linux cold start)
    if (isWindows() || isLinux()) {
      const deepLinkUrl = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
      if (deepLinkUrl) {
        // Small delay to ensure renderer is ready
        setTimeout(() => handleDeepLink(deepLinkUrl), 500);
      }
    }

    // Start watching Steam library for changes (after a short delay to ensure window is ready)
    setTimeout(() => {
      startSteamWatcher(getMainWindow());
      startInstallationWatcher(getMainWindow());
    }, 1000);

    app.on('activate', async () => {
      // macOS: показати вікно якщо воно заховане або створити нове якщо немає
      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      } else {
        await createMainWindow();
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

    if (!isMacOS()) {
      app.quit();
    }
  });
}
