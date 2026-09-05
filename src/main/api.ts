import type {
  FacetedFilterCounts,
  FacetedFilterCountsRequest,
  Game,
  GetGamesParams,
  GetGamesResult,
  SortOrderType,
  TagOption,
} from '../shared/types';
import { GamesRepository } from './db/games-repository';
import { getRecommendedGameIds } from './db/recommendations-source';

const gamesRepo = GamesRepository.getInstance();

export function fetchGames(params: GetGamesParams = {}): GetGamesResult {
  try {
    return gamesRepo.getGames(params);
  } catch (error) {
    console.error('[API] Error fetching games:', error);
    return { games: [], total: 0 };
  }
}

export function fetchGamesByIds(
  gameIds: string[],
  searchQuery?: string,
  hideAiTranslations = false,
  useSteamIdField = false,
  sortOrder: SortOrderType = 'name'
): Game[] {
  try {
    return gamesRepo.getGamesByIds(
      gameIds,
      searchQuery,
      hideAiTranslations,
      useSteamIdField,
      sortOrder
    );
  } catch (error) {
    console.error('[API] Error fetching games by IDs:', error);
    return [];
  }
}

export function findGamesByInstallPaths(
  installPaths: string[],
  searchQuery?: string,
  hideAiTranslations = false,
  sortOrder: SortOrderType = 'name',
  steamAppIds: number[] = []
): GetGamesResult {
  try {
    return gamesRepo.findGamesByInstallPaths(
      installPaths,
      searchQuery,
      hideAiTranslations,
      sortOrder,
      steamAppIds
    );
  } catch (error) {
    console.error('[API] Error finding games by install paths:', error);
    return { games: [], total: 0 };
  }
}

export function fetchTagOptions(): TagOption[] {
  try {
    return gamesRepo.getTagOptions();
  } catch (error) {
    console.error('[API] Error fetching tag options:', error);
    return [];
  }
}

export function fetchTeams(): string[] {
  try {
    return gamesRepo.getUniqueAuthors();
  } catch (error) {
    console.error('[API] Error fetching authors:', error);
    return [];
  }
}

export function fetchFacetedFilterCounts(
  request: FacetedFilterCountsRequest
): FacetedFilterCounts {
  try {
    return gamesRepo.getFacetedFilterCounts(request);
  } catch (error) {
    console.error('[API] Error fetching faceted filter counts:', error);
    return {
      statuses: {},
      tags: {},
      authors: {},
      contentTypes: { 'with-achievements': 0, 'with-voice': 0, 'from-workshop': 0 },
      specialFilters: {
        'favorite-translations': 0,
        'installed-translations': 0,
        'installed-games': 0,
        'available-in-steam': 0,
        'owned-gog-games': 0,
        'owned-epic-games': 0,
        'installed-xbox-games': 0,
      },
    };
  }
}

export function findGamesBySteamAppIds(
  steamAppIds: number[],
  searchQuery?: string,
  hideAiTranslations = false,
  sortOrder: SortOrderType = 'name'
): GetGamesResult {
  try {
    return gamesRepo.findGamesBySteamAppIds(
      steamAppIds,
      searchQuery,
      hideAiTranslations,
      sortOrder
    );
  } catch (error) {
    console.error('[API] Error finding games by Steam App IDs:', error);
    return { games: [], total: 0 };
  }
}

export function countGamesBySteamAppIds(steamAppIds: number[]): number {
  try {
    return gamesRepo.countGamesBySteamAppIds(steamAppIds);
  } catch (error) {
    console.error('[API] Error counting games by Steam App IDs:', error);
    return 0;
  }
}

export function fetchRecommendedGames(
  gameId: string,
  limit = 3,
  hideAiTranslations = false
): Game[] {
  try {
    const recommendedIds = getRecommendedGameIds(gameId, Math.max(0, limit));
    const normalizedLimit = Math.max(0, limit);
    const uniqueIds = [...new Set(recommendedIds)].slice(0, normalizedLimit);

    if (uniqueIds.length === 0) {
      return [];
    }

    const games = fetchGamesByIds(uniqueIds, undefined, hideAiTranslations);
    const gamesById = new Map(games.map((game) => [game.id, game]));

    return uniqueIds
      .map((id) => gamesById.get(id))
      .filter((game): game is Game => game !== undefined);
  } catch (error) {
    console.error('[API] Error fetching recommended games:', error);
    return [];
  }
}
