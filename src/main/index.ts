import { app, BrowserWindow } from 'electron';
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
