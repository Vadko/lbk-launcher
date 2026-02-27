import { useCallback, useEffect, useRef, useState } from 'react';
import type { FilterCountsResult } from '../../shared/types';
import { useStore } from '../store/useStore';

export type FilterCounts = FilterCountsResult & {
  'installed-translations': number;
  'installed-games': number;
  'available-in-steam': number;
  'owned-gog-games': number;
  'owned-epic-games': number;
};

const INITIAL_COUNTS: FilterCounts = {
  'installed-translations': 0,
  'installed-games': 0,
  'available-in-steam': 0,
  'owned-gog-games': 0,
  'owned-epic-games': 0,
  'with-achievements': 0,
  'with-voice': 0,
  planned: 0,
  'in-progress': 0,
  completed: 0,
};

const DEBOUNCE_DELAY = 300;

export function useFilterCounts() {
  const syncStatus = useStore((state) => state.syncStatus);
  const [counts, setCounts] = useState<FilterCounts>(INITIAL_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const fetchCounts = useCallback(async () => {
    try {
      const [
        sqlCounts,
        installedIds,
        installedPaths,
        steamLibraryAppIds,
        gogTitles,
        epicTitles,
      ] = await Promise.all([
        window.electronAPI.fetchFilterCounts(),
        window.electronAPI.getAllInstalledGameIds(),
        window.electronAPI.getAllInstalledGamePaths(),
        window.electronAPI.getSteamLibraryAppIds(),
        window.electronAPI.getGogLibrary(),
        window.electronAPI.getEpicLibrary(),
      ]);

      if (!isMountedRef.current) return;

      const [
        installedGamesResult,
        steamLibraryCount,
        gogLibraryResult,
        epicLibraryResult,
      ] = await Promise.all([
        installedPaths.length > 0
          ? window.electronAPI.findGamesByInstallPaths(installedPaths)
          : Promise.resolve({ games: [], total: 0, uniqueCount: 0 }),
        steamLibraryAppIds.length > 0
          ? window.electronAPI.countGamesBySteamAppIds(steamLibraryAppIds)
          : Promise.resolve(0),
        gogTitles.length > 0
          ? window.electronAPI.findGamesByTitles(gogTitles)
          : Promise.resolve({ games: [], total: 0 }),
        epicTitles.length > 0
          ? window.electronAPI.findGamesByTitles(epicTitles)
          : Promise.resolve({ games: [], total: 0 }),
      ]);

      if (!isMountedRef.current) return;

      setCounts({
        ...sqlCounts,
        'installed-translations': installedIds.length,
        'installed-games': installedGamesResult.uniqueCount ?? installedGamesResult.total,
        'available-in-steam': steamLibraryCount,
        'owned-gog-games': gogLibraryResult.total,
        'owned-epic-games': epicLibraryResult.total,
      });
    } catch (err) {
      console.error('[useFilterCounts] Error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const debouncedFetchCounts = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(fetchCounts, DEBOUNCE_DELAY);
  }, [fetchCounts]);

  useEffect(() => {
    isMountedRef.current = true;

    if (syncStatus !== 'ready' && syncStatus !== 'error') {
      return () => {
        isMountedRef.current = false;
      };
    }

    fetchCounts();

    const unsubInstalled =
      window.electronAPI?.onInstalledGamesChanged?.(debouncedFetchCounts);
    const unsubSteam = window.electronAPI?.onSteamLibraryChanged?.(debouncedFetchCounts);
    const unsubGame = window.electronAPI?.onGameUpdated?.(debouncedFetchCounts);

    return () => {
      isMountedRef.current = false;
      unsubInstalled?.();
      unsubSteam?.();
      unsubGame?.();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchCounts, debouncedFetchCounts, syncStatus]);

  return { counts, isLoading, refetch: fetchCounts };
}
