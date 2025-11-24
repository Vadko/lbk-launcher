import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { fetchGames } from './api';
import { installTranslation } from './installer';

let mainWindow: BrowserWindow | null = null;

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

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
