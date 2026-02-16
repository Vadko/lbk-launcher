import { app, ipcMain } from 'electron';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

function getStorePath(key: string): string {
  return join(app.getPath('userData'), `${key}.json`);
}

/**
 * Read a store file synchronously (returns raw JSON string or null).
 * Used by sync IPC handler and directly by main process (e.g. liquid glass preference).
 */
export function readStoreFile(key: string): string | null {
  try {
    const filePath = getStorePath(key);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`[StoreStorage] Error reading ${key}:`, error);
    return null;
  }
}

/**
 * Write a store file synchronously.
 * Data is on disk immediately after this call returns.
 */
function writeStoreFile(key: string, data: string): void {
  try {
    const filePath = getStorePath(key);
    writeFileSync(filePath, data, 'utf-8');
  } catch (error) {
    console.error(`[StoreStorage] Error writing ${key}:`, error);
  }
}

/**
 * Delete a store file (for clear-all-data scenarios).
 */
export function deleteStoreFile(key: string): void {
  try {
    const filePath = getStorePath(key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`[StoreStorage] Error deleting ${key}:`, error);
  }
}

/**
 * Register IPC handlers for store storage.
 * Must be called once during app initialization (before window creation).
 */
export function setupStoreStorageHandlers(): void {
  // Sync read — used by Zustand getItem for immediate hydration (no flash of defaults)
  ipcMain.on('store-storage:get', (event, key: string) => {
    event.returnValue = readStoreFile(key);
  });

  // Async write — used by Zustand setItem (fire-and-forget from renderer)
  ipcMain.handle('store-storage:set', (_event, key: string, data: string) => {
    writeStoreFile(key, data);
  });

  // Async remove
  ipcMain.handle('store-storage:remove', (_event, key: string) => {
    deleteStoreFile(key);
  });
}
