import type { StateStorage } from 'zustand/middleware';

/**
 * File-based storage adapter for Zustand persist middleware.
 * Uses IPC to read/write JSON files via the main process.
 *
 * - getItem: synchronous (sendSync IPC) — no flash of defaults
 * - setItem: async (invoke IPC, fire-and-forget) — non-blocking writes
 * - removeItem: async (invoke IPC, fire-and-forget)
 */
export const fileStorage: StateStorage = {
  getItem: (key: string): string | null => window.storeStorage.getItem(key),
  setItem: (key: string, value: string): void => {
    window.storeStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    window.storeStorage.removeItem(key);
  },
};

// One-time migration from localStorage to file storage.
// Runs at module import time, before any Zustand store calls getItem.
/* eslint-disable no-restricted-globals -- intentional: migrating data FROM localStorage */
(function migrateFromLocalStorage() {
  const keysToMigrate = ['lbk-settings', 'subscriptions-storage', 'has-launched-before'];

  for (const key of keysToMigrate) {
    try {
      // Skip if file storage already has data for this key
      const existingFileData = window.storeStorage.getItem(key);
      if (existingFileData !== null) continue;

      // Read from localStorage
      const localData = localStorage.getItem(key);
      if (localData === null) continue;

      // Write to file storage and clean up localStorage
      window.storeStorage.setItem(key, localData);
      localStorage.removeItem(key);

      console.log(`[Migration] Migrated "${key}" from localStorage to file storage`);
    } catch (error) {
      console.error(`[Migration] Failed to migrate "${key}":`, error);
    }
  }
})();
/* eslint-enable no-restricted-globals */
