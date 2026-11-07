import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { electronStorage } from './electronStorage';

interface EverInstalledStore {
  installedAt: Record<string, string>;
  markInstalled: (gameIds: readonly string[]) => void;
}

export const useEverInstalledStore = create<EverInstalledStore>()(
  persist(
    (set, get) => ({
      installedAt: {},

      // One persist write for the whole batch, and none when every id is already known
      markInstalled: (gameIds) => {
        const fresh = gameIds.filter((gameId) => !get().installedAt[gameId]);
        if (fresh.length === 0) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          installedAt: {
            ...state.installedAt,
            ...Object.fromEntries(fresh.map((gameId) => [gameId, now])),
          },
        }));
      },
    }),
    {
      name: 'ever-installed-storage',
      storage: createJSONStorage(() => electronStorage),
    }
  )
);
