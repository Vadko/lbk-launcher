import { ipcMain } from 'electron';
import { appEvents } from './app-events';
import { sendToRenderer } from './window';

export type SyncStatus = 'syncing' | 'ready' | 'error';

const sync: { status: SyncStatus } = { status: 'syncing' };

export function setSyncStatus(status: SyncStatus): void {
  sync.status = status;
  sendToRenderer('sync-status', status);
  appEvents.emit('sync-status', status);
}

// A failed sync still leaves the local catalog readable
export const isCatalogReady = (): boolean => sync.status !== 'syncing';

export function setupSyncStatusHandlers(): void {
  ipcMain.handle('get-sync-status', () => sync.status);
}
