import { ipcMain, Tray, Menu, app, nativeImage, Notification } from 'electron';
import { getMainWindow } from '../window';
import { join } from 'path';
import { isLinux, isMacOS } from '../utils/platform';

// Get the app icon path for notifications
function getNotificationIcon(): string | undefined {
  if (isMacOS()) {
    // macOS uses the app icon automatically
    return undefined;
  }
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

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

  let iconPath: string;

  if (isMacOS()) {
    // На macOS використовуємо Template іконку для автоматичної адаптації до теми
    const iconName = 'trayIconTemplate.png';
    iconPath = app.isPackaged
      ? join(process.resourcesPath, iconName)
      : join(app.getAppPath(), 'resources', iconName);
  } else {
    // Для інших платформ використовуємо звичайну іконку
    iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'resources', 'icon.png');
  }

  const icon = nativeImage.createFromPath(iconPath);

  // На macOS потрібно встановити що це Template іконка
  if (isMacOS()) {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Відкрити', click: showAndFocusWindow },
    { label: 'Вийти', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);

  // Linux (including Steam Deck) uses single click, others use double-click
  if (isLinux()) {
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

  // Check if window is visible (not minimized to tray)
  ipcMain.handle('window:is-visible', () => {
    const window = getMainWindow();
    return window?.isVisible() ?? false;
  });

  // Show system notification (used when app is in tray)
  ipcMain.handle('show-system-notification', (_, options: { title: string; body: string }) => {
    if (!Notification.isSupported()) {
      console.log('[Notification] System notifications not supported');
      return false;
    }

    const iconPath = getNotificationIcon();
    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: iconPath,
      silent: false,
    });

    // Click on notification opens the app
    notification.on('click', () => {
      showAndFocusWindow();
    });

    notification.show();
    return true;
  });
}
