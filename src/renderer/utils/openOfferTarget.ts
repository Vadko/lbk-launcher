import { useSettingsStore } from '../store/useSettingsStore';
import {
  type SteamPluginSetupSource,
  useSteamPluginSetupStore,
} from '../store/useSteamPluginSetupStore';
import type { OfferTarget } from './pluginHostOffer';
import { openMillenniumSite } from './steamBridge';
import { openDeckySite } from './steamPluginHost';

export function openOfferTarget(
  target: OfferTarget,
  source: SteamPluginSetupSource
): void {
  switch (target) {
    case 'millennium-site':
      openMillenniumSite();
      return;
    case 'decky-site':
      openDeckySite();
      return;
    case 'settings':
      useSettingsStore.getState().openSettingsModal();
      return;
    case 'millennium-install':
    case 'millennium-uninstall':
    case 'decky-install':
      useSteamPluginSetupStore.getState().openSetup(target, source);
      return;
  }
}
