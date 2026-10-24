import React from 'react';
import {
  type SteamPluginSetupVariant,
  useSteamPluginSetupStore,
} from '../../../store/useSteamPluginSetupStore';
import { DeckyPluginSetupFlow } from './DeckyPluginSetupFlow';
import { MillenniumInstallFlow } from './MillenniumInstallFlow';
import { MillenniumUninstallFlow } from './MillenniumUninstallFlow';

const FLOWS: Record<SteamPluginSetupVariant, React.FC> = {
  'millennium-install': MillenniumInstallFlow,
  'millennium-uninstall': MillenniumUninstallFlow,
  'decky-install': DeckyPluginSetupFlow,
};

export const SteamPluginSetupModal: React.FC = () => {
  const variant = useSteamPluginSetupStore((s) => s.variant);
  return React.createElement(FLOWS[variant]);
};
