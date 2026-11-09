import { createElement } from 'react';
import {
  type SteamPluginSetupVariant,
  useSteamPluginSetupStore,
} from '../../../store/useSteamPluginSetupStore';
import { DeckyPluginSetupFlow } from './DeckyPluginSetupFlow';
import { MillenniumInstallFlow } from './MillenniumInstallFlow';
import { MillenniumUninstallFlow } from './MillenniumUninstallFlow';

const FLOWS: Record<SteamPluginSetupVariant, React.ComponentType> = {
  'millennium-install': MillenniumInstallFlow,
  'millennium-uninstall': MillenniumUninstallFlow,
  'decky-install': DeckyPluginSetupFlow,
};

export function SteamPluginSetupModal() {
  const variant = useSteamPluginSetupStore((s) => s.variant);
  return createElement(FLOWS[variant]);
}
