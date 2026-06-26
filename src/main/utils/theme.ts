import { app } from 'electron';
import { join } from 'path';

function resolveResource(filename: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, filename)
    : join(app.getAppPath(), 'resources', filename);
}

export function getIcon(placement: 'tray' | 'notification' | 'window'): string {
  if (placement === 'tray') {
    return resolveResource('trayIconTemplate.png');
  }
  return resolveResource('icon-light.png');
}
