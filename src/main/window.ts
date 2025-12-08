import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { applyLiquidGlass, removeLiquidGlass, isLiquidGlassSupported } from './liquid-glass';
import { supportsMacOSLiquidGlass } from './utils/platform';

let mainWindow: BrowserWindow | null = null;
let liquidGlassId: number | null = null;

export async function createMainWindow(): Promise<BrowserWindow> {
  // Check if liquid glass is supported and get user preference
  const isSupported = supportsMacOSLiquidGlass();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    frame: false,
    show: false, // Don't show until liquid glass is applied
    transparent: isSupported, // Enable transparency for liquid glass on macOS 26+
    backgroundColor: isSupported ? undefined : '#050b14', // No background color when transparent
    vibrancy: undefined, // Must be undefined for liquid glass
    icon: join(app.getAppPath(), 'resources/icon.png'),
    webPreferences: {
      preload: join(app.getAppPath(), 'out/preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Show window buttons on macOS for liquid glass
  if (isSupported) {
    mainWindow.setWindowButtonVisibility(true);
  }

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'out/renderer/index.html'));
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', async () => {
    // Clean up liquid glass if it was applied
    if (liquidGlassId) {
      await removeLiquidGlass(liquidGlassId);
      liquidGlassId = null;
    }
    mainWindow = null;
  });

  // Відправляти стан maximize в renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false);
  });

  // Apply liquid glass immediately after window is ready (if supported)
  mainWindow.once('ready-to-show', async () => {
    if (isSupported) {
      console.log('[Window] Applying liquid glass on ready-to-show');
      // Apply with default enabled state - user can toggle it later in settings
      liquidGlassId = await applyLiquidGlass(mainWindow!, true);
      console.log('[Window] Liquid glass applied with ID:', liquidGlassId);
    }
    // Show window after liquid glass is applied (or immediately if not supported)
    mainWindow?.show();
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

// IPC handler for toggling liquid glass
ipcMain.handle('liquid-glass:toggle', async (_event, enabled: boolean) => {
  if (!mainWindow) return;

  if (enabled && supportsMacOSLiquidGlass()) {
    // Apply liquid glass if not already applied
    if (!liquidGlassId) {
      liquidGlassId = await applyLiquidGlass(mainWindow, true);
    }
  } else {
    // Remove liquid glass if applied
    if (liquidGlassId) {
      await removeLiquidGlass(liquidGlassId);
      liquidGlassId = null;
    }
  }
});

// IPC handler to check if liquid glass is supported
ipcMain.handle('liquid-glass:is-supported', () => {
  return isLiquidGlassSupported();
});
