import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { FacetRow, LibraryMemberships } from '../../shared/types';
import { useSyncAwareQuery } from '../queries/useSyncAwareQuery';
import { useStore } from '../store/useStore';
import { subscribeToWorkshopInstalledChanges } from '../store/useWorkshopInstallsStore';
import { allInstalledTranslationIds } from './useInstalledTranslations';

export interface FacetData {
  rows: FacetRow[];
  libraries: LibraryMemberships;
  installedTranslationIds: string[];
}

const RELOAD_DEBOUNCE = 300;
const ROWS_KEY = ['facet-rows'];
const LIBRARIES_KEY = ['library-memberships'];
const INSTALLED_KEY = ['installed-translation-ids'];

const idsKey = (rows: FacetRow[]) => rows.map((row) => row.id).join('|');

// A null IPC result becomes a query error, so the last good data stays
const orThrow = <T>(value: T | null, part: string): T => {
  if (value === null) {
    throw new Error(`[useFacetData] Failed to load ${part}`);
  }
  return value;
};

export function useFacetData(isModalOpen: boolean): FacetData | null {
  const queryClient = useQueryClient();
  const syncStatus = useStore((state) => state.syncStatus);
  const isCatalogReady = syncStatus === 'ready' || syncStatus === 'error';
  const [isWarm, setIsWarm] = useState(false);
  const enabled = isWarm || isModalOpen;

  const { data: rows } = useSyncAwareQuery({
    queryKey: ROWS_KEY,
    queryFn: async () => {
      const next = orThrow(await window.electronAPI.fetchFacetRows(), 'rows');
      const previous = queryClient.getQueryData<FacetRow[]>(ROWS_KEY);
      // Unlocking a hidden translation sends no event, but changes which games the libraries match
      if (previous && idsKey(previous) !== idsKey(next)) {
        void queryClient.invalidateQueries({ queryKey: LIBRARIES_KEY });
      }
      return next;
    },
    enabled,
    staleTime: Infinity,
    // useFacetCounts re-reads search matches whenever the rows identity changes
    structuralSharing: false,
  });
  const { data: libraries } = useSyncAwareQuery({
    queryKey: LIBRARIES_KEY,
    queryFn: async () =>
      orThrow(await window.electronAPI.getLibraryMemberships(), 'libraries'),
    enabled,
    staleTime: Infinity,
  });
  const { data: installedTranslationIds } = useSyncAwareQuery({
    queryKey: INSTALLED_KEY,
    queryFn: allInstalledTranslationIds,
    enabled,
    staleTime: Infinity,
  });

  // Prewarm off the critical path so the first modal open already has numbers
  useEffect(() => {
    if (!isCatalogReady || isWarm) {
      return;
    }
    const id = requestIdleCallback(() => setIsWarm(true), { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }, [isCatalogReady, isWarm]);

  useEffect(() => {
    const pending = new Set<QueryKey>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload =
      (...keys: QueryKey[]) =>
      () => {
        for (const key of keys) {
          pending.add(key);
        }
        clearTimeout(timer);
        timer = setTimeout(() => {
          for (const queryKey of pending) {
            void queryClient.invalidateQueries({ queryKey });
          }
          pending.clear();
        }, RELOAD_DEBOUNCE);
      };
    const onCatalogChanged = reload(ROWS_KEY, LIBRARIES_KEY);
    const onLibraryChanged = reload(LIBRARIES_KEY);

    window.addEventListener('test-games-updated', onCatalogChanged);
    const unsubscribers = [
      window.electronAPI.onGameUpdated(onCatalogChanged),
      window.electronAPI.onGameRemoved(onCatalogChanged),
      window.electronAPI.onInstalledGamesChanged?.(reload(LIBRARIES_KEY, INSTALLED_KEY)),
      window.electronAPI.onSteamLibraryChanged?.(onLibraryChanged),
      window.electronAPI.onStoreLibraryChanged(onLibraryChanged),
      subscribeToWorkshopInstalledChanges(reload(INSTALLED_KEY)),
    ];

    return () => {
      window.removeEventListener('test-games-updated', onCatalogChanged);
      for (const unsubscribe of unsubscribers) {
        unsubscribe?.();
      }
      clearTimeout(timer);
    };
  }, [queryClient]);

  // Delta sync and set-game-visibility send no per-game events, so re-read the cheap rows on open
  useEffect(() => {
    if (!isModalOpen || !isCatalogReady) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ROWS_KEY });
    // Re-probes the stores in main; an actual change comes back as store-library-changed
    window.electronAPI.checkStoreLibraries().catch((error) => {
      console.error('[useFacetData] Store library check failed:', error);
    });
  }, [isModalOpen, isCatalogReady, queryClient]);

  return useMemo(
    () =>
      rows && libraries && installedTranslationIds
        ? { rows, libraries, installedTranslationIds }
        : null,
    [rows, libraries, installedTranslationIds]
  );
}
