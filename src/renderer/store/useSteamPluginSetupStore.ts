import { create } from 'zustand';

export type SteamPluginSetupVariant =
  | 'millennium-install'
  | 'millennium-uninstall'
  | 'decky-install';

// 'offer' comes from a contextual suggestion and may be declined for good; 'settings' is user-initiated.
export type SteamPluginSetupSource = 'offer' | 'settings';

interface SteamPluginSetupStore {
  open: boolean;
  variant: SteamPluginSetupVariant;
  source: SteamPluginSetupSource;
  openSetup: (variant: SteamPluginSetupVariant, source: SteamPluginSetupSource) => void;
  close: () => void;
}

export const useSteamPluginSetupStore = create<SteamPluginSetupStore>((set) => ({
  open: false,
  variant: 'millennium-install',
  source: 'offer',

  openSetup: (variant, source) => set({ open: true, variant, source }),

  close: () => set({ open: false }),
}));
