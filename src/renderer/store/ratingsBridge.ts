import { F } from '@mobily/ts-belt';
import { isCatalogReady } from './isCatalogReady';
import { useRatingsStore } from './useRatingsStore';
import { useSettingsStore } from './useSettingsStore';
import { useStore } from './useStore';

// A sync or a burst of counter broadcasts sends one update per game
const RELOAD_DEBOUNCE = 300;

export function initRatings(): void {
  const api = window.electronAPI;
  const load = () => {
    if (!isCatalogReady()) {
      return;
    }
    const hideAi = useSettingsStore.getState().hideAiTranslations;
    void Promise.all([api.fetchTeamsRating(hideAi), api.fetchGamesRating(hideAi)]).then(
      ([teams, games]) => useRatingsStore.getState().setRatings(teams, games)
    );
  };
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  api.onGameCountersUpdated(reload);
  api.onGameUpdated(reload);
  api.onGameRemoved(reload);
  useStore.subscribe((state, prev) => {
    if (state.syncStatus !== prev.syncStatus) {
      reload();
    }
  });
  useSettingsStore.subscribe((state, prev) => {
    if (state.hideAiTranslations !== prev.hideAiTranslations) {
      load();
    }
  });
  load();
}
