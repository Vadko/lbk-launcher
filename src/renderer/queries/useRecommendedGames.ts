import type { Game } from '../types/game';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const FIVE_MINUTES = 5 * 60 * 1000;

export const recommendedGamesKeys = {
  all: ['recommended-games'] as const,
  byGame: (gameId: string, limit: number, hideAiTranslations: boolean) =>
    [...recommendedGamesKeys.all, gameId, limit, hideAiTranslations] as const,
};

export function useRecommendedGames(
  gameId?: string,
  limit = 3,
  hideAiTranslations = false
) {
  return useSyncAwareQuery({
    queryKey: recommendedGamesKeys.byGame(gameId ?? 'unknown', limit, hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      if (!gameId) {
        return [];
      }

      return window.electronAPI.fetchRecommendedGames(gameId, limit, hideAiTranslations);
    },
    enabled: !!gameId,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}
