import { useEffect, useMemo } from 'react';
import type { FacetRow, LibraryMemberships } from '../../shared/types';
import { loadCatalogFacets } from '../store/facetDataBridge';
import { useFacetDataStore } from '../store/useFacetDataStore';
import { useStore } from '../store/useStore';

export interface FacetData {
  rows: FacetRow[];
  libraries: LibraryMemberships;
  installedTranslationIds: readonly string[];
}

export function useFacetData(isModalOpen: boolean): FacetData | null {
  const syncStatus = useStore((state) => state.syncStatus);
  const isCatalogReady = syncStatus === 'ready' || syncStatus === 'error';
  const rows = useFacetDataStore((state) => state.rows);
  const libraries = useFacetDataStore((state) => state.libraries);
  const installedTranslationIds = useFacetDataStore(
    (state) => state.installedTranslationIds
  );

  useEffect(() => {
    if (!isModalOpen || !isCatalogReady) {
      return;
    }
    loadCatalogFacets();
    // Re-probes the stores in main; an actual change comes back as store-library-changed
    window.electronAPI.checkStoreLibraries().catch((error) => {
      console.error('[useFacetData] Store library check failed:', error);
    });
  }, [isModalOpen, isCatalogReady]);

  return useMemo(
    () =>
      rows && libraries && installedTranslationIds
        ? { rows, libraries, installedTranslationIds }
        : null,
    [rows, libraries, installedTranslationIds]
  );
}
