import { DISCOUNT_STORES } from '@/renderer/components/Elements/discountStores';
import { t } from '@/shared/i18n/i18n';
import type { StoreDiscount } from '@/shared/types';
import { Button } from '../ui/Button';

interface StoreSaleButtonProps {
  discount: StoreDiscount;
  page: string;
}

export function StoreSaleButton({ discount, page }: StoreSaleButtonProps) {
  const { name, Icon, open } = DISCOUNT_STORES[discount.store];

  return (
    <Button
      variant="secondary"
      icon={<Icon size={22} />}
      onClick={() => void open(page)}
      data-gamepad-action
      title={t('gameLinks.openIn', { store: name })}
      className="px-3! bg-white/25! border-white!"
    >
      <span className="font-bold text-base leading-none">-{discount.percent}%</span>
    </Button>
  );
}
