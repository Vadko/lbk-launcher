import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import {
  applyLiquidGlass,
  removeLiquidGlass,
  isLiquidGlassSupported,
} from './liquid-glass';
import { supportsMacOSLiquidGlass } from './utils/platform';

let mainWindow: BrowserWindow | null = null;
let liquidGlassId: number | null = null;

export async function createMainWindow(): Promise<BrowserWindow> {
  console.log('[Window] Creating main window...');

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
      // Disable web security in dev mode to allow cross-origin requests (R2 images)
      webSecurity: app.isPackaged,
    },
  });

  // Show window buttons on macOS for liquid glass
  if (isSupported) {
    mainWindow.setWindowButtonVisibility(true);
  }

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = process.env.ELECTRON_RENDERER_URL;
    console.log('[Window] Loading from URL (dev mode):', url);
    mainWindow.loadURL(url);
  } else {
    const htmlPath = join(app.getAppPath(), 'out/renderer/index.html');
    console.log('[Window] Loading from file (production):', htmlPath);
    console.log('[Window] app.getAppPath():', app.getAppPath());
    console.log('[Window] app.isPackaged:', app.isPackaged);
    mainWindow.loadFile(htmlPath);
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Track loading progress
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[Window] Started loading renderer');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Finished loading renderer');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[Window] DOM ready');
  });

  // Error handling for renderer process
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Window] Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL
    });
    // Show window anyway so user can see the error
    mainWindow?.show();
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Window] Render process gone:', details);
  });

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

  // Fallback timeout to show window if ready-to-show doesn't fire
  // This prevents black screen if renderer fails to load
  let windowShown = false;
  const showTimeout = setTimeout(() => {
    if (!windowShown && mainWindow && !mainWindow.isDestroyed()) {
      console.warn('[Window] Timeout reached (5s), showing window anyway');
      mainWindow.show();
      windowShown = true;
    }
  }, 5000); // Show after 5 seconds if ready-to-show hasn't fired

  // Apply liquid glass immediately after window is ready (if supported)
  mainWindow.once('ready-to-show', async () => {
    console.log('[Window] ready-to-show event fired');
    clearTimeout(showTimeout);
    if (isSupported) {
      console.log('[Window] Applying liquid glass on ready-to-show');
      // Apply with default enabled state - user can toggle it later in settings
      liquidGlassId = await applyLiquidGlass(mainWindow!, true);
      console.log('[Window] Liquid glass applied with ID:', liquidGlassId);
    }
    // Show window after liquid glass is applied (or immediately if not supported)
    if (!windowShown && mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Window] Showing window');
      mainWindow.show();
      windowShown = true;
    }
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
ipcMain.handle('liquid-glass:is-supported', () => isLiquidGlassSupported());
