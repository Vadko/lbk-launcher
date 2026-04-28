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
  list: (days: number) => [...trendingKeys.all, 'list', days] as const,
  withDetails: (days: number) => [...trendingKeys.all, 'details', days] as const,
};

/**
 * Отримати trending ігри (ID + кількість завантажень)
 * Завжди завантажує максимум 30 ігор для кешування
 */
export function useTrendingGamesList(days = 30) {
  return useQuery({
    queryKey: trendingKeys.list(days),
    queryFn: () => window.electronAPI.fetchTrendingGames(days, 30),
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
  });
}

/**
 * Отримати trending ігри з повними даними
 * Завжди завантажує максимум 30 ігор, slice робиться на UI рівні
 */
export function useTrendingGames(days = 30) {
  return useSyncAwareQuery({
    queryKey: trendingKeys.withDetails(days),
    queryFn: async (): Promise<TrendingGameWithDetails[]> => {
      const trending = await window.electronAPI.fetchTrendingGames(days, 30);
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
