import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FacetRow, LibraryMemberships } from '../../shared/types';
import { useStore } from '../store/useStore';
import { subscribeToWorkshopInstalledChanges } from '../store/useWorkshopInstallsStore';
import { allInstalledTranslationIds } from './useInstalledTranslations';

export interface FacetData {
  rows: FacetRow[];
  libraries: LibraryMemberships;
  installedTranslationIds: string[];
}

type FacetPart = 'rows' | 'libraries' | 'installed';

const RELOAD_DEBOUNCE = 300;

const idsKey = (rows: FacetRow[]) => rows.map((row) => row.id).join('|');

export function useFacetData(isModalOpen: boolean): FacetData | null {
  const syncStatus = useStore((state) => state.syncStatus);
  const isCatalogReady = syncStatus === 'ready' || syncStatus === 'error';

  const [rows, setRows] = useState<FacetRow[] | null>(null);
  const [libraries, setLibraries] = useState<LibraryMemberships | null>(null);
  const [installedTranslationIds, setInstalledTranslationIds] = useState<string[] | null>(
    null
  );

  const requestSeq = useRef<Record<FacetPart, number>>({
    rows: 0,
    libraries: 0,
    installed: 0,
  });
  const rowIdsKey = useRef<string | null>(null);
  const pendingParts = useRef(new Set<FacetPart>());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((part: FacetPart) => {
    function run(current: FacetPart): void {
      const seq = ++requestSeq.current[current];
      const isLatest = () => seq === requestSeq.current[current];

      const request =
        current === 'rows'
          ? window.electronAPI.fetchFacetRows().then((next) => {
              if (!next || !isLatest()) {
                return;
              }
              // Unlocking a hidden translation sends no event, but changes which games the libraries match
              const nextKey = idsKey(next);
              if (rowIdsKey.current !== null && rowIdsKey.current !== nextKey) {
                run('libraries');
              }
              rowIdsKey.current = nextKey;
              setRows(next);
            })
          : current === 'libraries'
            ? window.electronAPI.getLibraryMemberships().then((next) => {
                if (next && isLatest()) {
                  setLibraries(next);
                }
              })
            : allInstalledTranslationIds().then((next) => {
                if (isLatest()) {
                  setInstalledTranslationIds(next);
                }
              });

      request.catch((error) => {
        console.error(`[useFacetData] Failed to load ${current}:`, error);
      });
    }

    run(part);
  }, []);

  const scheduleLoad = useCallback(
    (...parts: FacetPart[]) => {
      for (const part of parts) {
        pendingParts.current.add(part);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        const due = [...pendingParts.current];
        pendingParts.current.clear();
        due.forEach(load);
      }, RELOAD_DEBOUNCE);
    },
    [load]
  );

  // Prewarm off the critical path so the first modal open already has numbers
  useEffect(() => {
    if (!isCatalogReady) {
      return;
    }
    const id = requestIdleCallback(
      () => {
        load('rows');
        load('libraries');
        load('installed');
      },
      { timeout: 2000 }
    );
    return () => cancelIdleCallback(id);
  }, [isCatalogReady, load]);

  useEffect(() => {
    if (!isCatalogReady) {
      return;
    }

    const pending = pendingParts.current;
    const onCatalogChanged = () => scheduleLoad('rows', 'libraries');
    const onInstalledChanged = () => scheduleLoad('libraries', 'installed');
    const onLibraryChanged = () => scheduleLoad('libraries');

    window.addEventListener('test-games-updated', onCatalogChanged);
    const unsubGameUpdated = window.electronAPI.onGameUpdated(onCatalogChanged);
    const unsubGameRemoved = window.electronAPI.onGameRemoved(onCatalogChanged);
    const unsubInstalled =
      window.electronAPI.onInstalledGamesChanged?.(onInstalledChanged);
    const unsubSteam = window.electronAPI.onSteamLibraryChanged?.(onLibraryChanged);
    const unsubStores = window.electronAPI.onStoreLibraryChanged(onLibraryChanged);
    const unsubWorkshop = subscribeToWorkshopInstalledChanges(() =>
      scheduleLoad('installed')
    );

    return () => {
      window.removeEventListener('test-games-updated', onCatalogChanged);
      unsubGameUpdated();
      unsubGameRemoved();
      unsubInstalled?.();
      unsubSteam?.();
      unsubStores();
      unsubWorkshop();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      pending.clear();
    };
  }, [isCatalogReady, scheduleLoad]);

  // Delta sync and set-game-visibility send no per-game events, so re-read the cheap rows on open
  useEffect(() => {
    if (!isModalOpen || !isCatalogReady) {
      return;
    }
    load('rows');
    // Re-probes the stores in main; an actual change comes back as store-library-changed
    window.electronAPI.checkStoreLibraries().catch((error) => {
      console.error('[useFacetData] Store library check failed:', error);
    });
  }, [isModalOpen, isCatalogReady, load]);

  return useMemo(
    () =>
      rows && libraries && installedTranslationIds
        ? { rows, libraries, installedTranslationIds }
        : null,
    [rows, libraries, installedTranslationIds]
  );
}
