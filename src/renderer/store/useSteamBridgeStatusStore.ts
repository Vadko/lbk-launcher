import { create } from 'zustand';
import type { SteamBridgeStatus } from '@/shared/types';

interface SteamBridgeStatusStore {
  status: SteamBridgeStatus | null;
  setStatus: (status: SteamBridgeStatus) => void;
  refresh: () => Promise<SteamBridgeStatus | null>;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

// Kept warm from App so dialogs render the last known badge at once and only revalidate on open.
export const useSteamBridgeStatusStore = create<SteamBridgeStatusStore>((set) => ({
  status: null,

  setStatus: (status) => set({ status }),

  refresh: async () => {
    try {
      const next = await window.electronAPI.getSteamBridgeStatus();
      if (next) {
        set({ status: next });
      }
      return next;
    } catch (error) {
      console.warn('[SteamBridgeStatus] Status fetch failed:', error);
      return null;
    }
  },

  recheck: async () => {
    try {
      const next = await window.electronAPI.recheckSteamBridge();
      if (next) {
        set({ status: next });
      }
      return next;
    } catch (error) {
      console.warn('[SteamBridgeStatus] Recheck failed:', error);
      return null;
    }
  },
}));
