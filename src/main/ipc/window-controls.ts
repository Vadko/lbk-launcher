import { ipcMain, Tray, Menu, app, nativeImage } from 'electron';
import { getMainWindow } from '../window';
import { join } from 'path';

let tray: Tray | null = null;

function createTray() {
  if (tray) return tray; // Якщо вже існує, повернути існуючий

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const updateContextMenu = () => {
    const window = getMainWindow();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Відкрити',
        click: function () {
          if (window) {
            window.show();
            if (window.isMinimized()) {
              window.restore();
            }
            window.focus();
          }
        },
      },
      {
        label: 'Вийти',
        click: function () {
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  const trayClickEvent = process.platform === 'linux' ? 'click' : 'double-click';

  tray.on(trayClickEvent, () => {
    const window = getMainWindow();
    if (window) {
      window.show();
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  updateContextMenu();
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
