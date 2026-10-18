import { create } from 'zustand';
import type { SteamBridgeStatus } from '@/shared/plugin-host-types';

interface SteamBridgeStatusStore {
  status: SteamBridgeStatus | null;
  setStatus: (status: SteamBridgeStatus) => void;
  refresh: () => Promise<SteamBridgeStatus | null>;
  recheck: () => Promise<SteamBridgeStatus | null>;
}

// Kept warm from App so dialogs render the last known badge at once and only revalidate on open.
export const useSteamBridgeStatusStore = create<SteamBridgeStatusStore>((set) => {
  const load = async (call: () => Promise<SteamBridgeStatus | null>, label: string) => {
    try {
      const next = await call();
      if (next) {
        set({ status: next });
      }
      return next;
    } catch (error) {
      console.warn(`[SteamBridgeStatus] ${label} failed:`, error);
      return null;
    }
  };

  return {
    status: null,

    setStatus: (status) => set({ status }),

    refresh: () => load(() => window.electronAPI.getSteamBridgeStatus(), 'Status fetch'),

    recheck: () => load(() => window.electronAPI.recheckSteamBridge(), 'Recheck'),
  };
});
