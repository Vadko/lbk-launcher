import type { SortOrderType } from '../../shared/types';
import type { Game } from '../types/game';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Query keys для ігор головної сторінки
 */
export const homeGamesKeys = {
  all: ['home-games'] as const,
  newest: (hideAi: boolean) => [...homeGamesKeys.all, 'newest', hideAi] as const,
  updated: (hideAi: boolean) => [...homeGamesKeys.all, 'updated', hideAi] as const,
  installedGames: (hideAi: boolean, sortOrder: SortOrderType) =>
    [...homeGamesKeys.all, 'installed-games', hideAi, sortOrder] as const,
};

/**
 * Отримати нові ігри (для секції "Новинки")
 */
export function useNewGames(hideAiTranslations = false) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.newest(hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      const result = await window.electronAPI.fetchGames({
        sortOrder: 'newest',
        hideAiTranslations,
      });
      return result.games;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}

/**
 * Отримати оновлені ігри (для секції "Новинки" -> таб "Оновлення")
 */
export function useUpdatedGames(hideAiTranslations = false) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.updated(hideAiTranslations),
    queryFn: async (): Promise<Game[]> => {
      const result = await window.electronAPI.fetchGames({
        sortOrder: 'updated',
        hideAiTranslations,
      });
      return result.games;
    },
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES,
  });
}

/**
 * Отримати встановлені ігри (на комп'ютері) для головної сторінки
 */
export function useInstalledGamesForHome(
  hideAiTranslations = false,
  sortOrder: SortOrderType = 'newest'
) {
  return useSyncAwareQuery({
    queryKey: homeGamesKeys.installedGames(hideAiTranslations, sortOrder),
    queryFn: async (): Promise<Game[]> => {
      const installPaths = await window.electronAPI.getAllInstalledGamePaths();

      if (installPaths.length === 0) {
        return [];
      }

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
