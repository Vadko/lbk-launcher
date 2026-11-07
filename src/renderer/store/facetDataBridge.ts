import { F } from '@mobily/ts-belt';
import type { FacetRow } from '../../shared/types';
import { allInstalledTranslationIds } from '../hooks/useInstalledTranslations';
import { isCatalogReady } from './isCatalogReady';
import { useFacetDataStore } from './useFacetDataStore';
import { useStore } from './useStore';
import { subscribeToWorkshopInstalledChanges } from './useWorkshopInstallsStore';

// A sync or a library rescan sends one event per game
const RELOAD_DEBOUNCE = 300;

const idsKey = (rows: FacetRow[]) => rows.map((row) => row.id).join('|');

const logFailure = (part: string) => (error: unknown) => {
  console.error(`[FacetData] Failed to load ${part}:`, error);
};

const loadLibraries = () => {
  if (!isCatalogReady()) {
    return;
  }
  window.electronAPI
    .getLibraryMemberships()
    .then(useFacetDataStore.getState().setLibraries)
    .catch(logFailure('libraries'));
};

const loadInstalledTranslationIds = () => {
  allInstalledTranslationIds()
    .then(useFacetDataStore.getState().setInstalledTranslationIds)
    .catch(logFailure('installed translations'));
};

const loadFilterOptions = () => {
  if (!isCatalogReady()) {
    return;
  }
  const api = window.electronAPI;
  Promise.all([api.fetchTeams(), api.fetchTagOptions()])
    .then(([teams, tags]) => useFacetDataStore.getState().setFilterOptions(teams, tags))
    .catch(logFailure('filter options'));
};

const loadRows = () => {
  if (!isCatalogReady()) {
    return;
  }
  window.electronAPI
    .fetchFacetRows()
    .then((next) => {
      const { rows: previous, setRows } = useFacetDataStore.getState();
      setRows(next);
      // Unlocking a hidden translation sends no event, but changes which games the libraries match
      if (next && previous && idsKey(previous) !== idsKey(next)) {
        loadLibraries();
      }
    })
    .catch(logFailure('rows'));
};

// Delta sync and set-game-visibility send no per-game events, so the filters re-read the catalog on open
export function loadCatalogFacets(): void {
  loadRows();
  loadFilterOptions();
}

const loadCatalog = () => {
  loadCatalogFacets();
  loadLibraries();
};

export function initFacetData(): void {
  const api = window.electronAPI;
  const reloadCatalog = F.debounce(loadCatalog, RELOAD_DEBOUNCE);
  const reloadLibraries = F.debounce(loadLibraries, RELOAD_DEBOUNCE);
  const reloadInstalled = F.debounce(loadInstalledTranslationIds, RELOAD_DEBOUNCE);
  // Off the critical path, so the first filters open already has numbers
  const loadCatalogWhenIdle = () => requestIdleCallback(loadCatalog, { timeout: 2000 });

  window.addEventListener('test-games-updated', reloadCatalog);
  api.onGameUpdated(reloadCatalog);
  api.onGameRemoved(reloadCatalog);
  api.onSteamLibraryChanged?.(reloadLibraries);
  api.onStoreLibraryChanged(reloadLibraries);
  api.onInstalledGamesChanged?.(() => {
    reloadLibraries();
    reloadInstalled();
  });
  subscribeToWorkshopInstalledChanges(reloadInstalled);
  useStore.subscribe((state, prev) => {
    if (state.syncStatus !== prev.syncStatus) {
      loadCatalogWhenIdle();
    }
  });
  loadCatalogWhenIdle();
  loadInstalledTranslationIds();
}
