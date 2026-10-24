import type {
  ContentTypeFilterType,
  FacetRow,
  Game,
  SpecialFilterType,
  TranslationTypeFilterType,
} from './types';

export const CONTENT_TYPE_FILTERS: readonly ContentTypeFilterType[] = [
  'with-achievements',
  'with-voice',
  'from-workshop',
];

export const TRANSLATION_TYPE_FILTERS: readonly TranslationTypeFilterType[] = [
  'manual',
  'ai',
  'ai-edited',
];

export const SPECIAL_FILTERS: readonly SpecialFilterType[] = [
  'favorite-translations',
  'installed-translations',
  'installed-games',
  'available-in-steam',
  'owned-gog-games',
  'owned-epic-games',
  'installed-xbox-games',
];

export function getGameGroupKey(
  game: Pick<Game, 'id' | 'slug' | 'steam_app_id'>
): string {
  if (game.steam_app_id !== null && game.steam_app_id !== undefined) {
    return `steam:${game.steam_app_id}`;
  }
  return game.slug ? `slug:${game.slug}` : `id:${game.id}`;
}

export function matchesStatuses(game: FacetRow, statuses?: string[]): boolean {
  return !statuses || statuses.length === 0 || statuses.includes(game.status);
}

export function matchesAuthors(game: FacetRow, authors?: string[]): boolean {
  if (!authors || authors.length === 0) {
    return true;
  }
  if (!game.team) {
    return false;
  }
  return authors.some((author) => game.team?.includes(author));
}

export function matchesTags(game: FacetRow, tagIds?: number[]): boolean {
  if (!tagIds || tagIds.length === 0) {
    return true;
  }
  return tagIds.some((tagId) => game.steam_tag_ids?.includes(tagId));
}

export function matchesContentTypes(
  game: FacetRow,
  contentTypes?: readonly ContentTypeFilterType[]
): boolean {
  if (!contentTypes || contentTypes.length === 0) {
    return true;
  }
  return contentTypes.every((type) => {
    if (type === 'with-achievements') {
      return !!game.achievements_archive_path;
    }
    if (type === 'from-workshop') {
      return game.kind === 'workshop';
    }
    return !!game.voice_archive_path || game.voice_progress !== null;
  });
}

export function matchesTranslationTypes(
  game: FacetRow,
  translationTypes?: readonly TranslationTypeFilterType[]
): boolean {
  if (!translationTypes || translationTypes.length === 0) {
    return true;
  }
  return translationTypes.some((type) => {
    if (type === 'manual') {
      return game.ai === null;
    }
    if (type === 'ai-edited') {
      return game.ai === 'edited';
    }
    return game.ai === 'non-edited';
  });
}
