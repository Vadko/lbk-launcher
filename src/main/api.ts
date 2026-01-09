import type { Game, GetGamesParams, GetGamesResult } from '../shared/types';
import { GamesRepository } from './db/games-repository';

// Використовуємо локальну базу даних замість Supabase
const gamesRepo = new GamesRepository();

export function fetchGames(params: GetGamesParams = {}): GetGamesResult {
  try {
    console.log('[API] Fetching games from local database with params:', params);
    const result = gamesRepo.getGames(params);
    console.log(`[API] Fetched ${result.games.length} games, total: ${result.total}`);
    return result;
  } catch (error) {
    console.error('[API] Error fetching games from local database:', error);
    return { games: [], total: 0 };
  }
}

export function fetchGamesByIds(gameIds: string[], searchQuery?: string): Game[] {
  try {
    console.log('[API] Fetching games by IDs:', gameIds.length, 'searchQuery:', searchQuery);
    const games = gamesRepo.getGamesByIds(gameIds, searchQuery);
    console.log(`[API] Fetched ${games.length} games by IDs`);
    return games;
  } catch (error) {
    console.error('[API] Error fetching games by IDs:', error);
    return [];
  }
}

export function findGamesByInstallPaths(installPaths: string[], searchQuery?: string): GetGamesResult {
  try {
    console.log('[API] Finding games by install paths:', installPaths.length, 'paths, searchQuery:', searchQuery);
    const result = gamesRepo.findGamesByInstallPaths(installPaths, searchQuery);
    console.log(
      `[API] Found ${result.games.length} games matching install paths, total: ${result.total}`
    );
    return result;
  } catch (error) {
    console.error('[API] Error finding games by install paths:', error);
    return { games: [], total: 0 };
  }
}

export function fetchTeams(): string[] {
  try {
    console.log('[API] Fetching unique authors from local database');
    const authors = gamesRepo.getUniqueAuthors();
    console.log(`[API] Fetched ${authors.length} unique authors`);
    return authors;
  } catch (error) {
    console.error('[API] Error fetching authors:', error);
    return [];
  }
}
