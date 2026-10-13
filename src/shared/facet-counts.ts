import { A, D, pipe } from '@mobily/ts-belt';
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
import type {
  ContentTypeFilterType,
  FacetRow,
  SpecialFilterType,
  TranslationTypeFilterType,
} from './types';

export interface FacetSelection {
  statuses: string[];
  contentTypes: ContentTypeFilterType[];
  translationTypes: TranslationTypeFilterType[];
  specialFilter: SpecialFilterType | null;
  authors: string[];
  tagIds: number[];
}

export interface FacetScope {
  memberships: Record<SpecialFilterType, ReadonlySet<string>>;
  searchMatchIds: ReadonlySet<string> | null;
  hideAiTranslations: boolean;
}

export interface FacetCounts {
  total: number;
  statuses: Record<string, number>;
  contentTypes: Record<ContentTypeFilterType, number>;
  translationTypes: Record<TranslationTypeFilterType, number>;
  specialFilters: Record<SpecialFilterType, number>;
  authors: Map<string, number>;
  tags: Map<number, number>;
}

interface FacetEntry {
  row: FacetRow;
  game: number;
  authors: readonly string[];
}

export type FacetIndex = readonly FacetEntry[];

export const EMPTY_FACET_SELECTION: FacetSelection = {
  statuses: [],
  contentTypes: [],
  translationTypes: [],
  specialFilter: null,
  authors: [],
  tagIds: [],
};

type FilterGroup = 'status' | 'content' | 'translation' | 'special' | 'author' | 'tag';

const GROUP_CHECKS: Record<
  FilterGroup,
  (
    row: FacetRow,
    selection: FacetSelection,
    specialMembers: ReadonlySet<string> | null
  ) => boolean
> = {
  status: (row, selection) => matchesStatuses(row, selection.statuses),
  content: (row, selection) => matchesContentTypes(row, selection.contentTypes),
  translation: (row, selection) =>
    matchesTranslationTypes(row, selection.translationTypes),
  special: (row, _, specialMembers) => !specialMembers || specialMembers.has(row.id),
  author: (row, selection) => matchesAuthors(row, selection.authors),
  tag: (row, selection) => matchesTags(row, selection.tagIds),
};

const FILTER_GROUP_CHECKS = A.map(D.keys(GROUP_CHECKS), (filterGroup) => ({
  filterGroup,
  passes: GROUP_CHECKS[filterGroup],
}));

// The hot loop below runs per row on every click, so it stays allocation-free: no per-row arrays or closures
const SEVERAL = 'several';

function findBlockingGroup(
  row: FacetRow,
  selection: FacetSelection,
  specialMembers: ReadonlySet<string> | null
): FilterGroup | null | typeof SEVERAL {
  let blockedBy: FilterGroup | null = null;
  for (const { filterGroup, passes } of FILTER_GROUP_CHECKS) {
    if (!passes(row, selection, specialMembers)) {
      if (blockedBy) {
        return SEVERAL;
      }
      blockedBy = filterGroup;
    }
  }
  return blockedBy;
}

const countsIn = (blockedBy: FilterGroup | null, filterGroup: FilterGroup) =>
  blockedBy === null || blockedBy === filterGroup;

const optionChecks = <K>(
  options: readonly K[],
  matches: (row: FacetRow, only: K[]) => boolean
) =>
  A.map(options, (option) => {
    const only = [option];
    return { option, check: (row: FacetRow) => matches(row, only) };
  });

const CONTENT_TYPE_CHECKS = optionChecks(CONTENT_TYPE_FILTERS, matchesContentTypes);
const TRANSLATION_TYPE_CHECKS = optionChecks(
  TRANSLATION_TYPE_FILTERS,
  matchesTranslationTypes
);

class GameCounter<K> {
  readonly counts = new Map<K, number>();
  private readonly lastGame = new Map<K, number>();

  add(key: K, game: number): void {
    if (this.lastGame.get(key) === game) {
      return;
    }
    this.lastGame.set(key, game);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  addAll(keys: readonly K[], game: number): void {
    for (const key of keys) {
      this.add(key, game);
    }
  }

  get(key: K): number {
    return this.counts.get(key) ?? 0;
  }
}

const countsFor = <K extends string>(keys: readonly K[], counter: GameCounter<K>) =>
  D.fromPairs(A.map(keys, (key) => [key, counter.get(key)] as const)) as Record<
    K,
    number
  >;

export function buildFacetIndex(
  rows: readonly FacetRow[],
  authors: readonly string[]
): FacetIndex {
  const gameIds = new Map<string, number>();
  const gameIdOf = (key: string) => {
    if (!gameIds.has(key)) {
      gameIds.set(key, gameIds.size);
    }
    return gameIds.get(key) ?? 0;
  };

  return pipe(
    rows,
    A.map((row) => ({
      row,
      game: gameIdOf(getGameGroupKey(row)),
      authors: row.team
        ? A.filter(authors, (author) => !!row.team?.includes(author))
        : [],
    })),
    A.sortBy((entry) => entry.game)
  );
}

export function computeFacetCounts(
  index: FacetIndex,
  selection: FacetSelection,
  scope: FacetScope
): FacetCounts {
  const { memberships, searchMatchIds, hideAiTranslations } = scope;
  const specialMembers = selection.specialFilter
    ? memberships[selection.specialFilter]
    : null;

  const total = new GameCounter<true>();
  const statuses = new GameCounter<string>();
  const contentTypes = new GameCounter<ContentTypeFilterType>();
  const translationTypes = new GameCounter<TranslationTypeFilterType>();
  const specialFilters = new GameCounter<SpecialFilterType>();
  const authors = new GameCounter<string>();
  const tags = new GameCounter<number>();

  for (const { row, game, authors: rowAuthors } of index) {
    if (
      (hideAiTranslations && row.ai !== null) ||
      (searchMatchIds && !searchMatchIds.has(row.id))
    ) {
      continue;
    }

    const blockedBy = findBlockingGroup(row, selection, specialMembers);
    if (blockedBy === SEVERAL) {
      continue;
    }

    if (blockedBy === null) {
      total.add(true, game);
      for (const { option, check } of CONTENT_TYPE_CHECKS) {
        if (check(row)) {
          contentTypes.add(option, game);
        }
      }
    }
    if (countsIn(blockedBy, 'status')) {
      statuses.add(row.status, game);
    }
    if (countsIn(blockedBy, 'translation')) {
      for (const { option, check } of TRANSLATION_TYPE_CHECKS) {
        if (check(row)) {
          translationTypes.add(option, game);
        }
      }
    }
    if (countsIn(blockedBy, 'special')) {
      for (const filter of SPECIAL_FILTERS) {
        if (memberships[filter].has(row.id)) {
          specialFilters.add(filter, game);
        }
      }
    }
    if (countsIn(blockedBy, 'author')) {
      authors.addAll(rowAuthors, game);
    }
    if (countsIn(blockedBy, 'tag') && row.steam_tag_ids) {
      tags.addAll(row.steam_tag_ids, game);
    }
  }

  return {
    total: total.get(true),
    statuses: Object.fromEntries(statuses.counts),
    contentTypes: countsFor(CONTENT_TYPE_FILTERS, contentTypes),
    translationTypes: countsFor(TRANSLATION_TYPE_FILTERS, translationTypes),
    specialFilters: countsFor(SPECIAL_FILTERS, specialFilters),
    authors: authors.counts,
    tags: tags.counts,
  };
}
