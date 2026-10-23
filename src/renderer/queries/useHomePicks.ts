import type { Game } from '../../shared/types';
import { orderHomePickGames } from '../utils/homePicks';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_HOUR = 60 * 60 * 1000;

interface HomePicksWithGames {
  title: string | null;
  games: Game[];
}

const homePicksKeys = {
  all: ['home-picks'] as const,
  withGames: (hideAiTranslations: boolean) =>
    [...homePicksKeys.all, 'with-games', hideAiTranslations] as const,
};

export function useHomePicks(hideAiTranslations: boolean) {
  return useSyncAwareQuery({
    queryKey: homePicksKeys.withGames(hideAiTranslations),
    queryFn: async (): Promise<HomePicksWithGames> => {
      const picks = await window.electronAPI.fetchHomePicks();
      if (!picks) {
        // Throwing keeps the last good data while a refresh fails; with none, the section stays hidden
        throw new Error('No current home picks');
      }

      const games = await window.electronAPI.fetchGamesByIds(
        picks.gameIds,
        undefined,
        hideAiTranslations
      );
      return { title: picks.title, games: orderHomePickGames(picks.gameIds, games) };
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    // The app turns this off globally; the launcher sits in the tray for days and a set rolls weekly
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
