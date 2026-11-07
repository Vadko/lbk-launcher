import type { Game } from '../../shared/types';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const FIVE_MINUTES = 5 * 60 * 1000;
const HOME_SECTION_FETCH_LIMIT = 10;

/**
 * Query keys for the home page games
 */
const homeGamesKeys = {
  all: ['home-games'] as const,
  newest: (hideAi: boolean) => [...homeGamesKeys.all, 'newest', hideAi] as const,
  updated: (hideAi: boolean) => [...homeGamesKeys.all, 'updated', hideAi] as const,
};

/**
 * Fetch new games (for the "Новинки" section)
 */
export function useNewGames(hideAiTranslations = false) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.newest(hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      const result = await window.electronAPI.fetchGames({
        sortOrder: 'newest',
        hideAiTranslations,
        limit: HOME_SECTION_FETCH_LIMIT,
      });
      return result.games;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}

/**
 * Fetch updated games (for the "Новинки" section -> "Оновлення" tab)
 */
export function useUpdatedGames(hideAiTranslations = false) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.updated(hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      const result = await window.electronAPI.fetchGames({
        sortOrder: 'updated',
        hideAiTranslations,
        limit: HOME_SECTION_FETCH_LIMIT,
      });
      return result.games;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}
