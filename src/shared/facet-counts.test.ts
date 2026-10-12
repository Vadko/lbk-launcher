import { describe, expect, it } from 'vitest';
import {
  buildFacetIndex,
  computeFacetCounts,
  EMPTY_FACET_SELECTION,
  type FacetScope,
  type FacetSelection,
} from './facet-counts';
import {
  CONTENT_TYPE_FILTERS,
  getGameGroupKey,
  matchesAuthors,
  matchesContentTypes,
  matchesStatuses,
  matchesTags,
  matchesTranslationTypes,
  SPECIAL_FILTERS,
  TRANSLATION_TYPE_FILTERS,
} from './game-filters';
import type { FacetRow, SpecialFilterType } from './types';

const STATUSES = ['planned', 'in-progress', 'completed', 'tech-improvement'] as const;
const AUTHORS = ['Den', 'Denys', 'Sich Team', 'Kurin', 'LBK'];
const TAGS = [1, 2, 3, 4, 5, 6];

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function subset<T>(random: () => number, items: readonly T[], chance: number): T[] {
  return items.filter(() => random() < chance);
}

function makeRows(random: () => number, count: number): FacetRow[] {
  return Array.from({ length: count }, (_, i) => {
    const appId = random() < 0.85 ? Math.floor(random() * (count / 2)) : null;
    const authors = subset(random, AUTHORS, 0.25);
    return {
      id: `game-${i}`,
      // Same app id with different slugs is the real-world case behind the duplicated count
      slug: random() < 0.2 ? '' : `slug-${Math.floor(random() * count)}`,
      steam_app_id: appId,
      status: pick(random, STATUSES),
      team: authors.length > 0 ? authors.join(', ') : '',
      steam_tag_ids: random() < 0.1 ? null : subset(random, TAGS, 0.3),
      ai: pick(random, [null, null, 'edited', 'non-edited']),
      kind: random() < 0.1 ? 'workshop' : 'regular',
      achievements_archive_path: random() < 0.3 ? 'a.zip' : null,
      voice_archive_path: random() < 0.2 ? 'v.zip' : null,
      voice_progress: random() < 0.1 ? 50 : null,
    } as FacetRow;
  });
}

function makeScope(
  random: () => number,
  rows: FacetRow[],
  withSearch: boolean
): FacetScope {
  const memberships = Object.fromEntries(
    SPECIAL_FILTERS.map((filter) => [
      filter,
      new Set(subset(random, rows, 0.3).map((row) => row.id)),
    ])
  ) as Record<SpecialFilterType, Set<string>>;
  return {
    memberships,
    searchMatchIds: withSearch
      ? new Set(subset(random, rows, 0.6).map((row) => row.id))
      : null,
    hideAiTranslations: random() < 0.3,
  };
}

function makeSelection(random: () => number): FacetSelection {
  return {
    statuses: subset(random, STATUSES, 0.3),
    contentTypes: subset(random, CONTENT_TYPE_FILTERS, 0.2),
    translationTypes: subset(random, TRANSLATION_TYPE_FILTERS, 0.3),
    specialFilter: random() < 0.5 ? pick(random, SPECIAL_FILTERS) : null,
    authors: subset(random, AUTHORS, 0.2),
    tagIds: subset(random, TAGS, 0.2),
  };
}

// What the sidebar would show for this selection: filtered rows, grouped into games
function listedGames(rows: FacetRow[], selection: FacetSelection, scope: FacetScope) {
  const keys = rows
    .filter(
      (row) =>
        (!scope.hideAiTranslations || row.ai === null) &&
        (!scope.searchMatchIds || scope.searchMatchIds.has(row.id)) &&
        (!selection.specialFilter ||
          scope.memberships[selection.specialFilter].has(row.id)) &&
        matchesStatuses(row, selection.statuses) &&
        matchesAuthors(row, selection.authors) &&
        matchesTags(row, selection.tagIds) &&
        matchesContentTypes(row, selection.contentTypes) &&
        matchesTranslationTypes(row, selection.translationTypes)
    )
    .map(getGameGroupKey);
  return new Set(keys).size;
}

describe('computeFacetCounts', () => {
  it('matches the filtered list for every option across random catalogs', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = createRandom(seed);
      const rows = makeRows(random, 40 + Math.floor(random() * 80));
      const scope = makeScope(random, rows, seed % 3 === 0);
      const selection = seed % 5 === 0 ? EMPTY_FACET_SELECTION : makeSelection(random);
      const index = buildFacetIndex(rows, AUTHORS);
      const counts = computeFacetCounts(index, selection, scope);

      expect(counts.total).toBe(listedGames(rows, selection, scope));

      for (const status of STATUSES) {
        expect(counts.statuses[status] ?? 0).toBe(
          listedGames(rows, { ...selection, statuses: [status] }, scope)
        );
      }
      for (const type of CONTENT_TYPE_FILTERS) {
        const contentTypes = [...new Set([...selection.contentTypes, type])];
        expect(counts.contentTypes[type]).toBe(
          listedGames(rows, { ...selection, contentTypes }, scope)
        );
      }
      for (const type of TRANSLATION_TYPE_FILTERS) {
        expect(counts.translationTypes[type]).toBe(
          listedGames(rows, { ...selection, translationTypes: [type] }, scope)
        );
      }
      for (const filter of SPECIAL_FILTERS) {
        expect(counts.specialFilters[filter]).toBe(
          listedGames(rows, { ...selection, specialFilter: filter }, scope)
        );
      }
      for (const author of AUTHORS) {
        expect(counts.authors.get(author) ?? 0).toBe(
          listedGames(rows, { ...selection, authors: [author] }, scope)
        );
      }
      for (const tagId of TAGS) {
        expect(counts.tags.get(tagId) ?? 0).toBe(
          listedGames(rows, { ...selection, tagIds: [tagId] }, scope)
        );
      }
    }
  });

  it('counts translations of one Steam game as a single game', () => {
    const base = {
      status: 'completed',
      team: 'LBK',
      steam_tag_ids: null,
      ai: null,
      kind: 'regular',
      achievements_archive_path: null,
      voice_archive_path: null,
      voice_progress: null,
    };
    const rows = [
      { ...base, id: 'a', slug: 'helldivers_ii', steam_app_id: 553850 },
      { ...base, id: 'b', slug: 'helldivers_2', steam_app_id: 553850 },
      { ...base, id: 'c', slug: 'stray', steam_app_id: 1332010 },
    ] as FacetRow[];
    const installed = new Set(['a', 'b', 'c']);
    const memberships = Object.fromEntries(
      SPECIAL_FILTERS.map((filter) => [filter, installed])
    ) as Record<SpecialFilterType, Set<string>>;

    const counts = computeFacetCounts(
      buildFacetIndex(rows, ['LBK']),
      EMPTY_FACET_SELECTION,
      { memberships, searchMatchIds: null, hideAiTranslations: false }
    );

    expect(counts.total).toBe(2);
    expect(counts.specialFilters['installed-games']).toBe(2);
    expect(counts.statuses.completed).toBe(2);
    expect(counts.authors.get('LBK')).toBe(2);
  });
});
