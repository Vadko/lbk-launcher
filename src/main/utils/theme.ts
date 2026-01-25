import { app, nativeTheme } from 'electron';
import { join } from 'path';
import { isMacOS } from '../utils/platform';

export function isDark(): boolean {
  return nativeTheme.shouldUseDarkColors;
}

export function isLight(): boolean {
  return !nativeTheme.shouldUseDarkColors;
}

export function getIcon(placement: 'tray' | 'notification' | 'window'): string {
  let iconPath: string;

  if (isMacOS() && placement === 'tray') {
    // На macOS використовуємо Template іконку для автоматичної адаптації до теми
    const iconName = 'trayIconTemplate.png';
    iconPath = app.isPackaged
      ? join(process.resourcesPath, iconName)
      : join(app.getAppPath(), 'resources', iconName);
  } else {
    // Для інших платформ використовуємо звичайну іконку
    iconPath = app.isPackaged
      ? join(process.resourcesPath, isLight() ? 'icon-dark.png' : 'icon.png')
      : join(app.getAppPath(), 'resources', isLight() ? 'icon-dark.png' : 'icon.png');
  }

  return iconPath;
}
