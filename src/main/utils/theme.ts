import { app, nativeTheme } from 'electron';
import { join } from 'path';
import { isMacOS } from '../utils/platform';

function isLight(): boolean {
  return !nativeTheme.shouldUseDarkColors;
}

function resolveResource(filename: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, filename)
    : join(app.getAppPath(), 'resources', filename);
}

export function getIcon(placement: 'tray' | 'notification' | 'window'): string {
  if (placement === 'tray') {
    if (isMacOS()) {
      // Template image — AppKit auto-inverts based on menu bar appearance.
      return resolveResource('trayIconTemplate.png');
    }
    // Win/Linux: small monochrome tray glyph, manual swap by system theme.
    return resolveResource(
      isLight() ? 'trayIconTemplateDark.png' : 'trayIconTemplate.png'
    );
  }

  // Window / notification: full app icon, themed against system.
  return resolveResource(isLight() ? 'icon-dark.png' : 'icon-light.png');
}
