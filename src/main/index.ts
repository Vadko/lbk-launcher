import { app, BrowserWindow, session } from 'electron';
import { createMainWindow } from './window';
import { setupWindowControls } from './ipc/window-controls';
import { setupGamesHandlers, cleanupGamesHandlers } from './ipc/games';
import { setupInstallerHandlers } from './ipc/installer';
import { setupAutoUpdater, checkForUpdates } from './auto-updater';

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
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  cleanupGamesHandlers();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
