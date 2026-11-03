import React from 'react';
import { useSteamDiscount } from '@/renderer/hooks/useSteamDiscount';
import { t } from '@/shared/i18n/i18n';
import { SteamIcon } from '../Icons/BrandIcons';

interface DiscountPillProps {
  steamAppId: number | null;
}

export const DiscountPill: React.FC<DiscountPillProps> = ({ steamAppId }) => {
  const percent = useSteamDiscount(steamAppId);

  if (steamAppId === null || percent <= 0) {
    return null;
  }

  const label = t('storeSale.discount', { percent, store: 'Steam' });

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 rounded-full leading-none text-text-dark p-[6px] ring-[6px] ring-[rgba(255,255,255,0.15)]"
    >
      <SteamIcon size={20} />-{percent}%
    </div>
  );
};
