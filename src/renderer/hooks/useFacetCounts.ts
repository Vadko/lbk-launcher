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
  }, [query, rows]);

  const index = useMemo(
    () => (rows ? buildFacetIndex(rows, authors) : null),
    [rows, authors]
  );

  const memberships = useMemo(() => {
    if (!libraries || !installedTranslationIds) {
      return null;
    }
    const memberships: FacetScope['memberships'] = {
      'favorite-translations': new Set(favoriteGameIds),
      'installed-translations': new Set(installedTranslationIds),
      'installed-games': new Set(libraries['installed-games']),
      'available-in-steam': new Set(libraries['available-in-steam']),
      'owned-gog-games': new Set(libraries['owned-gog-games']),
      'owned-epic-games': new Set(libraries['owned-epic-games']),
      'installed-xbox-games': new Set(libraries['installed-xbox-games']),
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
