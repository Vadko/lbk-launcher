import { ipcMain } from 'electron';
import ElectronStore from 'electron-store';

const store = new ElectronStore({
  name: 'lbk-store',
});

/**
 * Read a value from the store (returns raw string or null).
 * Used by sync IPC handler and directly by main process (e.g. liquid glass preference).
 */
function readStoreFile(key: string): string | null {
  const value = store.get(key) as string | undefined;
  return value ?? null;
}

/**
 * Read one field of a renderer zustand persist envelope (`{"state":{...}}`).
 * Returns the default on any miss or parse error.
 */
function readPersistedStateField<T>(storeKey: string, field: string, defaultValue: T): T {
  try {
    const raw = readStoreFile(storeKey);
    if (!raw) {
      return defaultValue;
    }
    return (JSON.parse(raw).state?.[field] as T) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function readRendererSetting<T>(field: string, defaultValue: T): T {
  return readPersistedStateField('lbk-settings', field, defaultValue);
}

const WORKSHOP_INSTALLS_KEY = 'workshop-installs-storage';

export function getWorkshopInstalledGameIds(): string[] {
  return Object.keys(
    readPersistedStateField<Record<string, unknown>>(
      WORKSHOP_INSTALLS_KEY,
      'installedAt',
      {}
    )
  );
}

export function onWorkshopInstallsChanged(callback: () => void): () => void {
  return store.onDidChange(WORKSHOP_INSTALLS_KEY, callback);
}

/**
 * Clear all data from the store.
 */
export function clearStore(): void {
  store.clear();
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
    store.set(key, data);
  });

  // Async remove
  ipcMain.handle('store-storage:remove', (_event, key: string) => {
    store.delete(key);
  });
}
