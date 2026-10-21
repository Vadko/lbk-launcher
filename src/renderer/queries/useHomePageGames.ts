import type { Game, SortOrderType } from '../../shared/types';
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
  installedGames: (hideAi: boolean, sortOrder: SortOrderType) =>
    [...homeGamesKeys.all, 'installed-games', hideAi, sortOrder] as const,
  installedPathsCount: () => [...homeGamesKeys.all, 'installed-paths-count'] as const,
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

/**
 * Fetch games installed on this computer for the home page
 */
export function useInstalledGamesForHome(
  hideAiTranslations = false,
  sortOrder: SortOrderType = 'newest'
) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.installedGames(hideAiTranslations, sortOrder),
    queryFn: async (): Promise<Game[]> => {
      // No early return on zero paths: main also matches installed Steam app ids
      const installPaths = await window.electronAPI.getAllInstalledGamePaths();
      const result = await window.electronAPI.findGamesByInstallPaths(
        installPaths,
        undefined,
        hideAiTranslations,
        sortOrder
      );

      return result.games;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}

/**
 * Number of games installed on the device (regardless of translation availability).
 * Lets us tell the scenarios apart: no games found at all vs. found, but with no translations.
 */
export function useInstalledGamePathsCount() {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.installedPathsCount(),
    queryFn: async (): Promise<number> => {
      const installPaths = await window.electronAPI.getAllInstalledGamePaths();
      return installPaths.length;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}
