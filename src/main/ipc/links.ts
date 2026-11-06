import { ipcMain } from 'electron';
import type { LinkApp } from '../../shared/types';
import { openAppLink } from '../utils/app-links';

export function setupLinksHandlers(): void {
  ipcMain.handle('open-app-link', (_, app: LinkApp, url: string) =>
    openAppLink(app, url)
  );
}
