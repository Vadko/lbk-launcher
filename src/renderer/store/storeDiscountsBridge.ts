import { F } from '@mobily/ts-belt';
import { useStoreDiscountsStore } from './useStoreDiscountsStore';

// A catch-up or a burst of broadcasts sends one update per batch
const RELOAD_DEBOUNCE = 300;

export function initStoreDiscounts(): void {
  const api = window.electronAPI;
  const { setDiscounts } = useStoreDiscountsStore.getState();
  const load = () => void api.getStoreDiscounts().then(setDiscounts);
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  api.onStoreDiscountsUpdated(reload);
  // Main leaves owned games out, so a purchase in a store hides its discount
  api.onSteamLibraryChanged?.(reload);
  api.onStoreLibraryChanged(reload);
  load();
}
