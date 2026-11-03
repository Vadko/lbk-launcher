import { create } from 'zustand';
import type { SteamDiscount } from '../../shared/types';

interface SteamDiscountsStore {
  percents: ReadonlyMap<number, number>;
  setDiscounts: (discounts: SteamDiscount[]) => void;
}

// Main owns the discounts and leaves owned games out; this mirrors them for rendering
export const useSteamDiscountsStore = create<SteamDiscountsStore>((set) => ({
  percents: new Map(),
  setDiscounts: (discounts) =>
    set({
      percents: new Map(
        discounts.map(({ steamAppId, percent }) => [steamAppId, percent])
      ),
    }),
}));
