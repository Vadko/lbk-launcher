import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import { isCatalogReady } from './isCatalogReady';
import { useStore } from './useStore';
import { useStoreDiscountsStore } from './useStoreDiscountsStore';

// A catch-up, a burst of broadcasts or a sync sends one update per batch or game
const RELOAD_DEBOUNCE = 300;

export function initStoreDiscounts(): void {
  const api = window.electronAPI;
  const { setDiscounts } = useStoreDiscountsStore.getState();
  // One read at a time, so an older answer never lands after a newer one
  const queue = pLimit(1);
  const load = () => void queue(() => api.getStoreDiscounts().then(setDiscounts));
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  api.onStoreDiscountsUpdated(reload);
  // Main leaves owned games out, so a purchase in a store hides its discount
  api.onSteamLibraryChanged?.(reload);
  api.onStoreLibraryChanged(reload);
  // GOG and Epic ownership is matched by catalog title, so a new or renamed game can hide a discount
  api.onGameUpdated(reload);
  api.onGameRemoved(reload);
  useStore.subscribe((state, prev) => {
    if (state.syncStatus !== prev.syncStatus && isCatalogReady()) {
      reload();
    }
  });
  load();
}
