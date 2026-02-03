import { useQuery } from '@tanstack/react-query';
import type { Game } from '../types/game';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_DAY = 24 * 60 * 60 * 1000;

export interface TrendingGameData {
  game_id: string;
  downloads: number;
}

export interface TrendingGameWithDetails extends Game {
  trendingDownloads: number; // Downloads за останні 30 днів
}

/**
 * Query keys для trending games
 */
export const trendingKeys = {
  all: ['trending'] as const,
  list: (days: number, limit: number) =>
    [...trendingKeys.all, 'list', days, limit] as const,
  withDetails: (days: number, limit: number) =>
    [...trendingKeys.all, 'details', days, limit] as const,
};

/**
 * Отримати trending ігри (ID + кількість завантажень)
 */
export function useTrendingGamesList(days = 30, limit = 10) {
  return useQuery({
    queryKey: trendingKeys.list(days, limit),
    queryFn: () => window.electronAPI.fetchTrendingGames(days, limit),
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
  });
}

/**
 * Отримати trending ігри з повними даними
 */
export function useTrendingGames(days = 30, limit = 10) {
  return useSyncAwareQuery({
    queryKey: trendingKeys.withDetails(days, limit),
    queryFn: async (): Promise<TrendingGameWithDetails[]> => {
      const trending = await window.electronAPI.fetchTrendingGames(days, limit);
      if (!trending || trending.length === 0) return [];

      const gameIds = trending.map((t) => t.game_id);
      const games = await window.electronAPI.fetchGamesByIds(gameIds);

      // Map games by ID for quick lookup
      const gamesMap = new Map(games.map((g) => [g.id, g]));

      // Iterate over trending (already sorted) to preserve order
      return trending
        .map((t) => {
          const game = gamesMap.get(t.game_id);
          return game ? { ...game, trendingDownloads: t.downloads } : null;
        })
        .filter((g): g is TrendingGameWithDetails => g !== null);
    },
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
  });
}
