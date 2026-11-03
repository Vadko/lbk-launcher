import React from 'react';
import { useStoreDiscounts } from '@/renderer/hooks/useStoreDiscounts';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '@/shared/types';
import { DISCOUNT_STORES } from './discountStores';

interface DiscountPillProps {
  game: Game;
}

// The biggest discount in a store this translation links to, so the pill matches the hero's buttons
export const DiscountPill: React.FC<DiscountPillProps> = ({ game }) => {
  const shown = useStoreDiscounts(game.steam_app_id).find(
    (discount) => DISCOUNT_STORES[discount.store].pageOf(game) !== null
  );

  if (!shown) {
    return null;
  }

  const { name, Icon } = DISCOUNT_STORES[shown.store];
  const label = t('storeSale.discount', { percent: shown.percent, store: name });

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="absolute top-5 left-5 flex items-center gap-2 bg-white/80 rounded-full leading-none text-text-dark p-[6px] ring-[6px] ring-[rgba(255,255,255,0.15)]"
    >
      <Icon size={20} />-{shown.percent}%
    </div>
  );
};
