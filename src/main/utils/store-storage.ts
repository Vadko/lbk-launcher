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

/** Opt-out from Settings. Lives here so `steam-cef.ts` reads it cycle-free. */
export function isCefDebuggingEnabledInSettings(): boolean {
  return readRendererSetting('steamCefDebuggingEnabled', true);
}

export function isProductAnalyticsEnabled(): boolean {
  return readRendererSetting('productAnalyticsEnabled', true);
}

export function isLocalizationAnalyticsEnabled(): boolean {
  return readRendererSetting('localizationAnalyticsEnabled', true);
}

export function isCrashDiagnosticsEnabled(): boolean {
  return readRendererSetting('crashDiagnosticsEnabled', true);
}

export function onRendererSettingsChanged(callback: () => void): () => void {
  return store.onDidChange('lbk-settings', callback);
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

// Keys main has touched through the helpers below; the renderer's storeStorage bridge may not overwrite them.
const mainOnlyKeys = new Set<string>();

export function readSteamAccountValue(key: string, accountId: string): unknown {
  mainOnlyKeys.add(key);
  const all = store.get(key) as Record<string, unknown> | undefined;
  return all?.[accountId];
}

export function writeSteamAccountValue(
  key: string,
  accountId: string,
  value: unknown
): void {
  mainOnlyKeys.add(key);
  const all = (store.get(key) as Record<string, unknown> | undefined) ?? {};
  store.set(key, { ...all, [accountId]: value });
}

// Main-only keys; the renderer's string-valued persist envelopes never share these names.
export function readStoreValue(key: string): unknown {
  mainOnlyKeys.add(key);
  return store.get(key);
}

export function writeStoreValue(key: string, value: unknown): void {
  mainOnlyKeys.add(key);
  if (value === undefined) {
    store.delete(key);
    return;
  }
  store.set(key, value);
}

export function deleteStoreValue(key: string): void {
  mainOnlyKeys.add(key);
  store.delete(key);
}

// Fires synchronously on every in-process write that changes the value.
export function onStoreValueChanged(key: string, callback: () => void): () => void {
  mainOnlyKeys.add(key);
  return store.onDidChange(key, () => callback());
}

const LAST_GAME_FOLDER_KEY = 'last-game-folder';

mainOnlyKeys.add(LAST_GAME_FOLDER_KEY);

export function readLastGameFolder(): string | undefined {
  const value = store.get(LAST_GAME_FOLDER_KEY);
  return typeof value === 'string' ? value : undefined;
}

export function writeLastGameFolder(folder: string): void {
  store.set(LAST_GAME_FOLDER_KEY, folder);
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
  // Zustand persist envelopes are always strings; anything else would land in main's own queues.
  ipcMain.handle('store-storage:set', (_event, key: unknown, data: unknown) => {
    if (typeof key !== 'string' || typeof data !== 'string' || mainOnlyKeys.has(key)) {
      console.warn(`[Store] Refused a renderer write to ${String(key)}`);
      return;
    }
    store.set(key, data);
  });

  // Async remove
  ipcMain.handle('store-storage:remove', (_event, key: unknown) => {
    if (typeof key !== 'string' || mainOnlyKeys.has(key)) {
      console.warn(`[Store] Refused a renderer delete of ${String(key)}`);
      return;
    }
    store.delete(key);
  });
}
