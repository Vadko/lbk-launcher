import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import { useHomeInstalledGamesStore } from './useHomeInstalledGamesStore';
import { useSettingsStore } from './useSettingsStore';
import { useStore } from './useStore';

// A sync or a library rescan sends one event per game
const RELOAD_DEBOUNCE = 300;

const isCatalogReady = () => {
  const { syncStatus } = useStore.getState();
  return syncStatus === 'ready' || syncStatus === 'error';
};

const readInstalledGames = async () => {
  const api = window.electronAPI;
  const hideAi = useSettingsStore.getState().hideAiTranslations;
  const paths = await api.getAllInstalledGamePaths();
  // No early return on zero paths: main also matches installed Steam app ids
  const { games } = await api.findGamesByInstallPaths(paths, undefined, hideAi, 'newest');
  useHomeInstalledGamesStore.getState().setInstalledGames(games, paths.length);
};

export function initHomeInstalledGames(): void {
  const api = window.electronAPI;
  // One read at a time, so an older answer never lands after a newer one
  const queue = pLimit(1);
  const load = () => {
    if (!isCatalogReady()) {
      return;
    }
    queue(readInstalledGames).catch((error) => {
      console.error('[HomeInstalledGames] Failed to load installed games:', error);
    });
  };
  const reload = F.debounce(load, RELOAD_DEBOUNCE);

  window.addEventListener('test-games-updated', reload);
  api.onGameUpdated(reload);
  api.onGameRemoved(reload);
  api.onSteamLibraryChanged?.(reload);
  api.onStoreLibraryChanged(reload);
  useStore.subscribe((state, prev) => {
    if (state.syncStatus !== prev.syncStatus) {
      load();
    }
  });
  useSettingsStore.subscribe((state, prev) => {
    if (state.hideAiTranslations !== prev.hideAiTranslations) {
      load();
    }
  });
  load();
}
