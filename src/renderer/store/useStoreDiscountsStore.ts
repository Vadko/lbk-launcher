import { A } from '@mobily/ts-belt';
import { create } from 'zustand';
import type { StoreDiscount } from '../../shared/types';

interface StoreDiscountsStore {
  byApp: ReadonlyMap<number, readonly StoreDiscount[]>;
  setDiscounts: (discounts: StoreDiscount[]) => void;
}

// Main owns the discounts and leaves owned games out; this mirrors them per app, the biggest first
export const useStoreDiscountsStore = create<StoreDiscountsStore>((set) => ({
  byApp: new Map(),
  setDiscounts: (discounts) =>
    set({
      byApp: Map.groupBy(
        A.sort(discounts, (a, b) => b.percent - a.percent),
        (discount) => discount.steamAppId
      ),
    }),
}));
