import { app, session } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { setupWindowControls, initTray } from './ipc/window-controls';
import { setupGamesHandlers, cleanupGamesHandlers } from './ipc/games';
import { setupInstallerHandlers } from './ipc/installer';
import { setupAutoUpdater, checkForUpdates } from './auto-updater';
import { startSteamWatcher, stopSteamWatcher } from './steam-watcher';
import { startInstallationWatcher, stopInstallationWatcher } from './installation-watcher';

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
  app.whenReady().then(() => {
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
    cleanupGamesHandlers();
    stopSteamWatcher();
    stopInstallationWatcher();

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
