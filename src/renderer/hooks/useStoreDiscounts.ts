import type { StoreDiscount } from '../../shared/types';
import { useResourcesStore } from '../store/useResourcesStore';

const NONE: readonly StoreDiscount[] = [];

// The biggest discount first; selecting one app's list keeps other cards from re-rendering
export function useStoreDiscounts(steamAppId: number | null): readonly StoreDiscount[] {
  return useResourcesStore((state) =>
    steamAppId === null ? NONE : (state.values.storeDiscounts?.get(steamAppId) ?? NONE)
  );
}
