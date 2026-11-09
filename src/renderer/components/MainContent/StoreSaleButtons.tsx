import { A, O } from '@mobily/ts-belt';
import { DISCOUNT_STORES } from '@/renderer/components/Elements/discountStores';
import { useStoreDiscounts } from '@/renderer/hooks/useStoreDiscounts';
import type { Game } from '@/shared/types';
import { StoreSaleButton } from './StoreSaleButton';

interface StoreSaleButtonsProps {
  game: Game;
}

export function StoreSaleButtons({ game }: StoreSaleButtonsProps) {
  const sales = A.filterMap(useStoreDiscounts(game.steam_app_id), (discount) =>
    O.map(O.fromNullable(DISCOUNT_STORES[discount.store].pageOf(game)), (page) => ({
      discount,
      page,
    }))
  );

  if (sales.length === 0) {
    return null;
  }

  return (
    <>
      {sales.map(({ discount, page }) => (
        <StoreSaleButton key={discount.store} discount={discount} page={page} />
      ))}
      <div className="hidden sm:block w-0 h-10 my-auto mx-2 border-l border-border-hover" />
    </>
  );
}
