import type { StateStorage } from 'zustand/middleware';

/**
 * Electron-store storage adapter for Zustand persist middleware.
 * Uses IPC to read/write via electron-store in the main process.
 *
 * - getItem: synchronous (sendSync IPC) — no flash of defaults
 * - setItem: async (invoke IPC, fire-and-forget) — non-blocking writes
 * - removeItem: async (invoke IPC, fire-and-forget)
 */
export const electronStorage: StateStorage = {
  getItem: (key: string): string | null => {
    if (!window.storeStorage) return null;
    return window.storeStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (!window.storeStorage) return;
    window.storeStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    if (!window.storeStorage) return;
    window.storeStorage.removeItem(key);
  },
};

// One-time migration from localStorage to electron-store.
// Runs at module import time, before any Zustand store calls getItem.
/* eslint-disable no-restricted-globals -- intentional: migrating data FROM localStorage */
const MIGRATION_KEY = '__migration-v1-done';

(function migrateFromLocalStorage() {
  // Safety check: ensure storeStorage is available (preload script may not have run yet)
  if (!window.storeStorage) {
    console.warn('[Migration] window.storeStorage not available yet, skipping migration');
    return;
  }
  
  if (window.storeStorage.getItem(MIGRATION_KEY) !== null) return;

  const keysToMigrate = ['lbk-settings', 'subscriptions-storage', 'has-launched-before'];

  for (const key of keysToMigrate) {
    try {
      const localData = localStorage.getItem(key);
      if (localData === null) continue;

      window.storeStorage.setItem(key, localData);
      localStorage.removeItem(key);

      console.log(`[Migration] Migrated "${key}" from localStorage to electron-store`);
    } catch (error) {
      console.error(`[Migration] Failed to migrate "${key}":`, error);
    }
  }

  window.storeStorage.setItem(MIGRATION_KEY, '1');
})();
/* eslint-enable no-restricted-globals */
