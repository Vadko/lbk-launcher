import { ipcMain, Tray, Menu, app, nativeImage } from 'electron';
import { getMainWindow } from '../window';
import { join } from 'path';

let tray: Tray;

function createTray() {
  const window = getMainWindow();

  const iconPath = join(app.getAppPath(), 'resources/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const appIcon = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Відкрити',
      click: function () {
        window?.show();
      },
    },
    {
      label: 'Вийти',
      click: function () {
        app.quit();
      },
    },
  ]);

  appIcon.on('double-click', () => {
    window?.show();
  });
  appIcon.setContextMenu(contextMenu);
  return appIcon;
}

export function setupWindowControls(): void {
  ipcMain.on('window:minimize', () => {
    const window = getMainWindow();
    window?.hide();
    tray = createTray();
  });

  ipcMain.on('windows: restore', () => {
    const window = getMainWindow();

    window?.show();
    tray?.destroy();
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
