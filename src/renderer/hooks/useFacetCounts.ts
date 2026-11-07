import { F } from '@mobily/ts-belt';
import { useEffect, useMemo, useState } from 'react';
import {
  buildFacetIndex,
  computeFacetCounts,
  EMPTY_FACET_SELECTION,
  type FacetCounts,
  type FacetScope,
  type FacetSelection,
} from '../../shared/facet-counts';
import { useSettingsStore } from '../store/useSettingsStore';
import type { FacetData } from './useFacetData';

// A rename or a keyword edit keeps the facet rows equal, so main sends no new ones
const CATALOG_EDIT_DEBOUNCE_MS = 300;

interface UseFacetCountsParams {
  data: FacetData | null;
  authors: string[];
  selection: FacetSelection;
  searchQuery: string;
  hideAiTranslations: boolean;
}

interface FacetCountsResult {
  counts: FacetCounts;
  globalCounts: FacetCounts;
}

export function useFacetCounts({
  data,
  authors,
  selection,
  searchQuery,
  hideAiTranslations,
}: UseFacetCountsParams): FacetCountsResult | null {
  const favoriteGameIds = useSettingsStore((state) => state.favoriteGameIds);
  const rows = data?.rows;
  const libraries = data?.libraries;
  const installedTranslationIds = data?.installedTranslationIds;
  const query = searchQuery.trim();
  const [searchMatches, setSearchMatches] = useState<{
    query: string;
    ids: ReadonlySet<string>;
  } | null>(null);
  const [catalogEdits, setCatalogEdits] = useState(0);

  useEffect(() => {
    if (!query) {
      return;
    }
    const edited = F.makeControlledDebounce(() => setCatalogEdits((count) => count + 1), {
      delay: CATALOG_EDIT_DEBOUNCE_MS,
      leading: false,
    });
    const offUpdated = window.electronAPI.onGameUpdated(() => edited.schedule());
    const offRemoved = window.electronAPI.onGameRemoved(() => edited.schedule());
    return () => {
      edited.cancel();
      offUpdated();
      offRemoved();
    };
  }, [query]);

  useEffect(() => {
    if (!query) {
      return;
    }
    let cancelled = false;
    window.electronAPI
      .fetchSearchMatchIds(query)
      .then((ids) => {
        if (ids && !cancelled) {
          setSearchMatches({ query, ids: new Set(ids) });
        }
      })
      .catch((error) => {
        console.error('[useFacetCounts] Failed to load search matches:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [query, rows, catalogEdits]);

  const index = useMemo(
    () => (rows ? buildFacetIndex(rows, authors) : null),
    [rows, authors]
  );

  const memberships = useMemo(() => {
    if (!libraries || !installedTranslationIds) {
      return null;
    }
    const memberships: FacetScope['memberships'] = {
      ...libraries,
      'favorite-translations': new Set(favoriteGameIds),
      'installed-translations': installedTranslationIds,
    };
    return memberships;
  }, [libraries, installedTranslationIds, favoriteGameIds]);

  const globalCounts = useMemo(
    () =>
      index && memberships
        ? computeFacetCounts(index, EMPTY_FACET_SELECTION, {
            memberships,
            searchMatchIds: null,
            hideAiTranslations,
          })
        : null,
    [index, memberships, hideAiTranslations]
  );

  const searchMatchIds = !query
    ? null
    : searchMatches?.query === query
      ? searchMatches.ids
      : undefined;

  const counts = useMemo(
    () =>
      index && memberships && searchMatchIds !== undefined
        ? computeFacetCounts(index, selection, {
            memberships,
            searchMatchIds,
            hideAiTranslations,
          })
        : null,
    [index, memberships, searchMatchIds, selection, hideAiTranslations]
  );

  return useMemo(
    () => (counts && globalCounts ? { counts, globalCounts } : null),
    [counts, globalCounts]
  );
}
