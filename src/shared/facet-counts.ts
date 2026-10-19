import { A, D, pipe } from '@mobily/ts-belt';
import {
  countsFor,
  GameCounter,
  type OptionCount,
  optionChecks,
  optionCounts,
} from './game-counter';
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
  statuses: Map<string, OptionCount>;
  contentTypes: Record<ContentTypeFilterType, number>;
  translationTypes: Map<TranslationTypeFilterType, OptionCount>;
  specialFilters: Record<SpecialFilterType, number>;
  authors: Map<string, OptionCount>;
  tags: Map<number, OptionCount>;
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

// The passes below run per row on every click, so they stay allocation-free: no per-row arrays or closures
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

const countsIn = (
  blockedBy: ReturnType<typeof findBlockingGroup>,
  filterGroup: FilterGroup
) => blockedBy === null || blockedBy === filterGroup;

const CONTENT_TYPE_CHECKS = optionChecks(CONTENT_TYPE_FILTERS, matchesContentTypes);
const TRANSLATION_TYPE_CHECKS = optionChecks(
  TRANSLATION_TYPE_FILTERS,
  matchesTranslationTypes
);

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
  const addedStatuses = new GameCounter<string>();
  const addedTranslationTypes = new GameCounter<TranslationTypeFilterType>();
  const addedAuthors = new GameCounter<string>();
  const addedTags = new GameCounter<number>();

  const specialChecks = A.map(SPECIAL_FILTERS, (filter) => ({
    option: filter,
    check: (row: FacetRow) => memberships[filter].has(row.id),
  }));

  const blocks = A.map(index, ({ row }) =>
    (hideAiTranslations && row.ai !== null) ||
    (!!searchMatchIds && !searchMatchIds.has(row.id))
      ? SEVERAL
      : findBlockingGroup(row, selection, specialMembers)
  );
  const listedGames = new Set<number>();

  A.forEachWithIndex(index, (i, { row, game, authors: rowAuthors }) => {
    const blockedBy = blocks[i];
    if (blockedBy === null) {
      listedGames.add(game);
      total.add(true, game);
      contentTypes.addMatching(CONTENT_TYPE_CHECKS, row, game);
    }
    if (countsIn(blockedBy, 'status')) {
      statuses.add(row.status, game);
    }
    if (countsIn(blockedBy, 'translation')) {
      translationTypes.addMatching(TRANSLATION_TYPE_CHECKS, row, game);
    }
    if (countsIn(blockedBy, 'special')) {
      specialFilters.addMatching(specialChecks, row, game);
    }
    if (countsIn(blockedBy, 'author')) {
      authors.addAll(rowAuthors, game);
    }
    if (countsIn(blockedBy, 'tag') && row.steam_tag_ids) {
      tags.addAll(row.steam_tag_ids, game);
    }
  });

  A.forEachWithIndex(index, (i, { row, game, authors: rowAuthors }) => {
    const blockedBy = blocks[i];
    if (listedGames.has(game)) {
      return;
    }
    if (blockedBy === 'status') {
      addedStatuses.add(row.status, game);
    }
    if (blockedBy === 'translation') {
      addedTranslationTypes.addMatching(TRANSLATION_TYPE_CHECKS, row, game);
    }
    if (blockedBy === 'author') {
      addedAuthors.addAll(rowAuthors, game);
    }
    if (blockedBy === 'tag' && row.steam_tag_ids) {
      addedTags.addAll(row.steam_tag_ids, game);
    }
  });

  return {
    total: total.get(true),
    statuses: optionCounts(
      statuses.counts.keys(),
      selection.statuses,
      statuses,
      addedStatuses
    ),
    contentTypes: countsFor(CONTENT_TYPE_FILTERS, contentTypes),
    translationTypes: optionCounts(
      TRANSLATION_TYPE_FILTERS,
      selection.translationTypes,
      translationTypes,
      addedTranslationTypes
    ),
    specialFilters: countsFor(SPECIAL_FILTERS, specialFilters),
    authors: optionCounts(
      authors.counts.keys(),
      selection.authors,
      authors,
      addedAuthors
    ),
    tags: optionCounts(tags.counts.keys(), selection.tagIds, tags, addedTags),
  };
}
