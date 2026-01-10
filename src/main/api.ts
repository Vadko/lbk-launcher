import type { Game, GetGamesParams, GetGamesResult, FilterCountsResult } from '../shared/types';
import { GamesRepository } from './db/games-repository';

const gamesRepo = new GamesRepository();

export function fetchGames(params: GetGamesParams = {}): GetGamesResult {
  try {
    return gamesRepo.getGames(params);
  } catch (error) {
    console.error('[API] Error fetching games:', error);
    return { games: [], total: 0 };
  }
}

export function fetchGamesByIds(gameIds: string[], searchQuery?: string, showAiTranslations = false): Game[] {
  try {
    return gamesRepo.getGamesByIds(gameIds, searchQuery, showAiTranslations);
  } catch (error) {
    console.error('[API] Error fetching games by IDs:', error);
    return [];
  }
}

export function findGamesByInstallPaths(installPaths: string[], searchQuery?: string, showAiTranslations = false): GetGamesResult {
  try {
    return gamesRepo.findGamesByInstallPaths(installPaths, searchQuery, showAiTranslations);
  } catch (error) {
    console.error('[API] Error finding games by install paths:', error);
    return { games: [], total: 0 };
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

export function fetchFilterCounts(): FilterCountsResult {
  try {
    return gamesRepo.getFilterCounts();
  } catch (error) {
    console.error('[API] Error fetching filter counts:', error);
    return { planned: 0, 'in-progress': 0, completed: 0, 'with-achievements': 0 };
  }
}
