import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getMainWindow } from './window';

let updateCheckInterval: NodeJS.Timeout | null = null;

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

function handleUpdateError(error: unknown): void {
  console.error('[AutoUpdater] Check failed:', error);
}

export function checkForUpdates(): void {
  if (app.isPackaged) {
    // Initial check after 3 seconds
    setTimeout(() => autoUpdater.checkForUpdates().catch(handleUpdateError), 3000);

    // Check every 30 minutes
    updateCheckInterval = setInterval(
      () => autoUpdater.checkForUpdates().catch(handleUpdateError),
      1800000
    );
  }
}

export function stopUpdateCheck(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}
