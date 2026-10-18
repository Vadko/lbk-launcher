import { useSettingsStore } from '../store/useSettingsStore';
import {
  type SteamPluginSetupSource,
  useSteamPluginSetupStore,
} from '../store/useSteamPluginSetupStore';
import type { OfferTarget } from './pluginHostOffer';
import { openDeckySite, openMillenniumSite } from './steamPluginHost';

const OPENERS: Record<OfferTarget, (source: SteamPluginSetupSource) => void> = {
  'millennium-site': openMillenniumSite,
  'decky-site': openDeckySite,
  settings: () => useSettingsStore.getState().openSettingsModal(),
  'millennium-install': (source) =>
    useSteamPluginSetupStore.getState().openSetup('millennium-install', source),
  'millennium-uninstall': (source) =>
    useSteamPluginSetupStore.getState().openSetup('millennium-uninstall', source),
  'decky-install': (source) =>
    useSteamPluginSetupStore.getState().openSetup('decky-install', source),
};

export function openOfferTarget(
  target: OfferTarget,
  source: SteamPluginSetupSource
): void {
  OPENERS[target](source);
}
