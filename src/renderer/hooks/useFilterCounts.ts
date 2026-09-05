import { useCallback, useEffect, useRef, useState } from 'react';
import type { FacetedFilterCounts, FacetedFilterCountsRequest } from '../../shared/types';
import type {
  ContentTypeFilterType,
  SpecialFilterType,
} from '../components/Sidebar/types';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStore } from '../store/useStore';
import { subscribeToWorkshopInstalledChanges } from '../store/useWorkshopInstallsStore';
import { allInstalledTranslationIds } from './useInstalledTranslations';

interface UseFilterCountsParams {
  selectedStatuses?: string[];
  selectedAuthors?: string[];
  selectedTagIds?: number[];
  specialFilter?: SpecialFilterType | null;
  selectedContentTypes?: ContentTypeFilterType[];
  searchQuery?: string;
  hideAiTranslations?: boolean;
  /** Full author list to compute per-author counts against. */
  authors: string[];
  /** Only fetch while the filters modal is actually open - counts aren't shown otherwise. */
  enabled: boolean;
}

const EMPTY_COUNTS: FacetedFilterCounts = {
  statuses: {},
  tags: {},
  authors: {},
  contentTypes: { 'with-achievements': 0, 'with-voice': 0, 'from-workshop': 0 },
  specialFilters: {
    'favorite-translations': 0,
    'installed-translations': 0,
    'installed-games': 0,
    'available-in-steam': 0,
    'owned-gog-games': 0,
    'owned-epic-games': 0,
    'installed-xbox-games': 0,
  },
};

const DEBOUNCE_DELAY = 300;

export function useFilterCounts({
  selectedStatuses,
  selectedAuthors,
  selectedTagIds,
  specialFilter,
  selectedContentTypes,
  searchQuery,
  hideAiTranslations,
  authors,
  enabled,
}: UseFilterCountsParams) {
  const syncStatus = useStore((state) => state.syncStatus);
  const favoriteGameIds = useSettingsStore((state) => state.favoriteGameIds);
  const [counts, setCounts] = useState<FacetedFilterCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const fetchCounts = useCallback(async () => {
    try {
      const [
        installedTranslationGameIds,
        installedGamePaths,
        steamLibraryAppIds,
        gogTitles,
        epicTitles,
        xboxFolderNames,
      ] = await Promise.all([
        allInstalledTranslationIds(),
        window.electronAPI.getAllInstalledGamePaths(),
        window.electronAPI.getSteamLibraryAppIds(),
        window.electronAPI.getGogLibrary(),
        window.electronAPI.getEpicLibrary(),
        window.electronAPI.getXboxInstalledPaths(),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const request: FacetedFilterCountsRequest = {
        searchQuery,
        statuses: selectedStatuses,
        authors: selectedAuthors,
        tagIds: selectedTagIds,
        contentTypes: selectedContentTypes,
        specialFilter,
        hideAiTranslations,
        knownAuthors: authors,
        favoriteGameIds,
        installedTranslationGameIds,
        installedGamePaths,
        steamLibraryAppIds,
        gogTitles,
        epicTitles,
        xboxFolderNames,
      };

      const result = await window.electronAPI.fetchFacetedFilterCounts(request);

      if (!isMountedRef.current) {
        return;
      }

      setCounts(result);
    } catch (err) {
      console.error('[useFilterCounts] Error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    searchQuery,
    selectedStatuses,
    selectedAuthors,
    selectedTagIds,
    selectedContentTypes,
    specialFilter,
    hideAiTranslations,
    authors,
    favoriteGameIds,
  ]);

  const debouncedFetchCounts = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(fetchCounts, DEBOUNCE_DELAY);
  }, [fetchCounts]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || (syncStatus !== 'ready' && syncStatus !== 'error')) {
      return () => {
        isMountedRef.current = false;
      };
    }

    debouncedFetchCounts();

    // [DEV ONLY] Listen for test games updates
    const handleTestGamesUpdate = () => debouncedFetchCounts();
    window.addEventListener('test-games-updated', handleTestGamesUpdate);

    const unsubInstalled =
      window.electronAPI?.onInstalledGamesChanged?.(debouncedFetchCounts);

    const unsubWorkshop = subscribeToWorkshopInstalledChanges(debouncedFetchCounts);
    const unsubSteam = window.electronAPI?.onSteamLibraryChanged?.(debouncedFetchCounts);
    const unsubGame = window.electronAPI?.onGameUpdated?.(debouncedFetchCounts);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('test-games-updated', handleTestGamesUpdate);
      unsubInstalled?.();
      unsubWorkshop();
      unsubSteam?.();
      unsubGame?.();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, syncStatus, debouncedFetchCounts]);

  return { counts, isLoading, refetch: fetchCounts };
}
