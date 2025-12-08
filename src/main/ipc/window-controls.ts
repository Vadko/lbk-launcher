import { ipcMain, Tray, Menu, app, nativeImage } from 'electron';
import { getMainWindow } from '../window';
import { join } from 'path';

let tray: Tray | null = null;

/**
 * Show and focus the main window
 */
function showAndFocusWindow(): void {
  const window = getMainWindow();
  if (window) {
    window.show();
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  }
}

function createTray() {
  if (tray) return tray;

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Відкрити', click: showAndFocusWindow },
    { label: 'Вийти', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);

  // Linux (including Steam Deck) uses single click, others use double-click
  if (process.platform === 'linux') {
    tray.on('click', showAndFocusWindow);
  } else {
    tray.on('double-click', showAndFocusWindow);
  }

  return tray;
}

export function initTray(): void {
  createTray();
}

export function setupWindowControls(): void {
  ipcMain.on('window:minimize', () => {
    const window = getMainWindow();
    window?.hide();
  });

  ipcMain.on('windows: restore', () => {
    const window = getMainWindow();
    window?.show();
  });

  ipcMain.on('window:maximize', () => {
    const window = getMainWindow();
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    getMainWindow()?.close();
  });
}
