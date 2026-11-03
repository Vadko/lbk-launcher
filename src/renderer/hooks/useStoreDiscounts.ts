import type { StoreDiscount } from '../../shared/types';
import { useStoreDiscountsStore } from '../store/useStoreDiscountsStore';

const NONE: readonly StoreDiscount[] = [];

// The biggest discount first
export function useStoreDiscounts(steamAppId: number | null): readonly StoreDiscount[] {
  return useStoreDiscountsStore((state) =>
    steamAppId === null ? NONE : (state.byApp.get(steamAppId) ?? NONE)
  );
}
