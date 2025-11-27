import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getMainWindow } from './window';

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    getMainWindow()?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    getMainWindow()?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.webContents.send('update-progress', progress);
  });

  ipcMain.handle('download-update', () => autoUpdater.downloadUpdate());
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
}

export function checkForUpdates(): void {
  if (app.isPackaged) {
    // Initial check after 3 seconds
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);

    // Check every 30 minutes
    setInterval(() => autoUpdater.checkForUpdates(), 1800000);
  }
}
