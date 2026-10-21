import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Game } from '../../shared/types';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const FIVE_MINUTES = 5 * 60 * 1000;

const recommendedGamesKeys = {
  all: ['recommended-games'] as const,
  byGame: (gameId: string, limit: number, hideAiTranslations: boolean) =>
    [...recommendedGamesKeys.all, gameId, limit, hideAiTranslations] as const,
};

function useRecommendedGamesQuery(
  gameId: string | undefined,
  limit: number,
  hideAiTranslations: boolean,
  enabled: boolean
) {
  return useSyncAwareQuery({
    queryKey: recommendedGamesKeys.byGame(gameId ?? 'unknown', limit, hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      if (!gameId) {
        return [];
      }

      return window.electronAPI.fetchRecommendedGames(gameId, limit, hideAiTranslations);
    },
    enabled: !!gameId && enabled,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}

// The game page asks for the same limit as its section, so both share one cached query
export function useRecommendedGames(gameId: string | undefined, limit: number) {
  const { hideAiTranslations, showRecommendations } = useSettingsStore(
    useShallow((state) => ({
      hideAiTranslations: state.hideAiTranslations,
      showRecommendations: state.showRecommendations,
    }))
  );
  const { data, isLoading } = useRecommendedGamesQuery(
    gameId,
    limit,
    hideAiTranslations,
    showRecommendations
  );
  const games = useMemo(
    () => (data ?? []).filter((game) => game.id !== gameId).slice(0, limit),
    [data, gameId, limit]
  );

  return {
    games,
    isLoading,
    isHidden: !showRecommendations || (!isLoading && games.length === 0),
  };
}
