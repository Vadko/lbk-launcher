import { useEffect, useMemo } from 'react';
import type { FacetRow, LibraryMemberships } from '../../shared/types';
import { useResource } from './useResource';

export interface FacetData {
  rows: FacetRow[];
  libraries: LibraryMemberships;
  installedTranslationIds: ReadonlySet<string>;
}

export function useFacetData(isModalOpen: boolean): FacetData | null {
  const rows = useResource('facetRows');
  const libraries = useResource('libraries');
  const installedTranslationIds = useResource('installedTranslationIds');

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }
    // Re-probes the stores in main; an actual change comes back with the libraries
    window.electronAPI.checkStoreLibraries().catch((error) => {
      console.error('[useFacetData] Store library check failed:', error);
    });
  }, [isModalOpen]);

  return useMemo(
    () =>
      rows && libraries && installedTranslationIds
        ? { rows, libraries, installedTranslationIds }
        : null,
    [rows, libraries, installedTranslationIds]
  );
}
