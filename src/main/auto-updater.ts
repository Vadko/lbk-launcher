import { app, ipcMain } from 'electron';
import { autoUpdater, NsisUpdater } from 'electron-updater';
import type * as WinVerifySignature from 'win-verify-signature';
import { checkForPortableUpdates, stopPortableUpdateCheck } from './portable-updater';
import { isPortable, isWindows } from './utils/platform';
import { getMainWindow } from './window';

// Conditionally import based on platform
const winVerifySignature: typeof WinVerifySignature | null =
  isWindows() && process.env.NODE_ENV !== 'development'
    ? require('win-verify-signature')
    : null;

let updateCheckInterval: NodeJS.Timeout | null = null;

export function setupAutoUpdater(): void {
  if (isPortable()) {
    // Portable builds can't self-update; UI shows a "download new version" link instead.
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Native WinVerifyTrust instead of the default PowerShell Get-AuthenticodeSignature,
  // which intermittently fails (AV locks, 20s timeout): electron-builder#2589
  if (winVerifySignature && autoUpdater instanceof NsisUpdater) {
    autoUpdater.verifyUpdateCodeSignature = async (publisherNames, path) => {
      const result = await winVerifySignature.verifySignatureByPublishNameAsync(
        path,
        publisherNames
      );
      return result.signed ? null : result.message;
    };
  }

  autoUpdater.on('update-available', (info) => {
    getMainWindow()?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    getMainWindow()?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.webContents.send('update-progress', progress);
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);
    getMainWindow()?.webContents.send('update-error', error);
  });

  ipcMain.handle('download-update', async () => {
    try {
      return await autoUpdater.downloadUpdate();
    } catch (error) {
      // Already reported to the renderer via the 'error' event above.
      console.error('[AutoUpdater] Download failed:', error);
      return null;
    }
  });
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
}

function handleUpdateError(error: unknown): void {
  console.error('[AutoUpdater] Check failed:', error);
}

export function checkForUpdates(): void {
  if (isPortable()) {
    checkForPortableUpdates();
    return;
  }

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
  if (isPortable()) {
    stopPortableUpdateCheck();
    return;
  }
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}
