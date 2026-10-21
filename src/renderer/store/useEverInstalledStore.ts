import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { electronStorage } from './electronStorage';

interface EverInstalledStore {
  installedAt: Record<string, string>;
  markInstalled: (gameId: string) => void;
}

export const useEverInstalledStore = create<EverInstalledStore>()(
  persist(
    (set, get) => ({
      installedAt: {},

      markInstalled: (gameId) => {
        if (get().installedAt[gameId]) {
          return;
        }
        set((state) => ({
          installedAt: { ...state.installedAt, [gameId]: new Date().toISOString() },
        }));
      },
    }),
    {
      name: 'ever-installed-storage',
      storage: createJSONStorage(() => electronStorage),
    }
  )
);
