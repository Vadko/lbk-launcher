import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { fetchGames } from './api';
import { installTranslation, checkInstallation } from './installer';
import { subscribeToGameUpdates } from '../lib/api';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let unsubscribeRealtime: (() => void) | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../../out/renderer/index.html'));
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Window controls
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// IPC Handlers
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
  // Unsubscribe from previous subscription if exists
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
  }

  // Subscribe to game updates
  unsubscribeRealtime = subscribeToGameUpdates((updatedGame) => {
    // Send update to renderer process
    mainWindow?.webContents.send('game-updated', updatedGame);
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

ipcMain.handle('install-translation', async (_, gameId: string, platform: string) => {
  try {
    await installTranslation(gameId, platform, (progress) => {
      mainWindow?.webContents.send('install-progress', progress);
    });
  } catch (error) {
    console.error('Error installing translation:', error);
    throw error;
  }
});

ipcMain.handle('check-installation', async (_, gameId: string) => {
  try {
    return await checkInstallation(gameId);
  } catch (error) {
    console.error('Error checking installation:', error);
    return null;
  }
});

ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('select-game-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Оберіть папку з грою',
    buttonLabel: 'Обрати',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Configure for private repository
// Users need to set GITHUB_TOKEN environment variable or
// we can embed it in the app (not recommended for security)
if (process.env.GH_TOKEN) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Vadko',
    repo: 'littlebit-launcher',
    private: true,
    token: process.env.GH_TOKEN,
  });
}

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  mainWindow?.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  mainWindow?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
  mainWindow?.webContents.send('update-error', error);
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-progress', progress);
});

// IPC handlers for updates
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { available: false, message: 'Updates only work in packaged app' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Check for updates after 3 seconds (only in production)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cleanup real-time subscription
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
