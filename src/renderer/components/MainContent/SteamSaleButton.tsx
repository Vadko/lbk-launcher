import React from 'react';
import { useSteamDiscount } from '@/renderer/hooks/useSteamDiscount';
import { t } from '@/shared/i18n/i18n';
import { steamStoreUrl } from '@/shared/steam-urls';
import { SteamIcon } from '../Icons/BrandIcons';
import { Button } from '../ui/Button';

interface SteamSaleButtonProps {
  steamAppId: number | null;
}

export const SteamSaleButton: React.FC<SteamSaleButtonProps> = ({ steamAppId }) => {
  const percent = useSteamDiscount(steamAppId);

  if (steamAppId === null || percent <= 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        icon={<SteamIcon size={22} />}
        onClick={() =>
          void window.electronAPI.openAppLink('steam', steamStoreUrl(steamAppId))
        }
        data-gamepad-action
        title={t('gameLinks.openIn', { store: 'Steam' })}
        className="px-3!"
      >
        <span className="font-bold text-base leading-none">-{percent}%</span>
      </Button>
      <div className="w-0 h-10 my-auto mx-2 border-l border-border-hover" />
    </>
  );
};
