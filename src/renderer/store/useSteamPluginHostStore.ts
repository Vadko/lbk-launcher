import { create } from 'zustand';
import type { PluginHostState } from '@/shared/plugin-host-types';

interface SteamPluginHostStore {
  state: PluginHostState | null;
  setState: (state: PluginHostState) => void;
  refresh: () => Promise<PluginHostState | null>;
}

// Kept current by the push in useSteamBridgeStatusSync; components only revalidate when they open.
export const useSteamPluginHostStore = create<SteamPluginHostStore>((set) => ({
  state: null,

  setState: (state) => set({ state }),

  refresh: async () => {
    try {
      const next = await window.electronAPI.getPluginHostState();
      if (next) {
        set({ state: next });
      }
      return next;
    } catch (error) {
      console.warn('[SteamPluginHost] State fetch failed:', error);
      return null;
    }
  },
}));
