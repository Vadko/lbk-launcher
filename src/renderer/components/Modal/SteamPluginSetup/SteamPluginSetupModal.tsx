import React from 'react';
import { useSteamPluginSetupStore } from '../../../store/useSteamPluginSetupStore';
import { DeckyPluginSetupFlow } from './DeckyPluginSetupFlow';
import { MillenniumInstallFlow } from './MillenniumInstallFlow';
import { MillenniumUninstallFlow } from './MillenniumUninstallFlow';

export const SteamPluginSetupModal: React.FC = () => {
  const variant = useSteamPluginSetupStore((s) => s.variant);

  switch (variant) {
    case 'decky-install':
      return <DeckyPluginSetupFlow />;
    case 'millennium-uninstall':
      return <MillenniumUninstallFlow />;
    default:
      return <MillenniumInstallFlow />;
  }
};
