import { F } from '@mobily/ts-belt';
import { useSteamDiscountsStore } from './useSteamDiscountsStore';

// A catch-up or a burst of broadcasts sends one update per batch
const RELOAD_DEBOUNCE = 300;

export function initSteamDiscounts(): void {
  const api = window.electronAPI;
  const { setDiscounts } = useSteamDiscountsStore.getState();
  const load = () => void api.getSteamDiscounts().then(setDiscounts);
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  api.onSteamDiscountsUpdated(reload);
  // Main leaves owned games out, so a purchase in Steam hides its discount
  api.onSteamLibraryChanged?.(reload);
  load();
}
