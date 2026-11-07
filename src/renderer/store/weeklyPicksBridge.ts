import { F } from '@mobily/ts-belt';
import { isCatalogReady } from './isCatalogReady';
import { useSettingsStore } from './useSettingsStore';
import { useStore } from './useStore';
import { useWeeklyPicksStore } from './useWeeklyPicksStore';

// A sync or a bulk catalog update sends one event per game
const RELOAD_DEBOUNCE = 300;

export function initWeeklyPicks(): void {
  const api = window.electronAPI;
  const load = () => {
    if (!isCatalogReady()) {
      return;
    }
    const { setPicks, failRead } = useWeeklyPicksStore.getState();
    void api
      .getWeeklyPicks(useSettingsStore.getState().hideAiTranslations)
      .then(setPicks, (error: unknown) => {
        console.error('[WeeklyPicks] Failed to read the set:', error);
        failRead();
      });
  };
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  api.onWeeklyPicksUpdated(reload);
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
