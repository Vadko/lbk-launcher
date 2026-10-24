import type { Game } from '../../shared/types';
import { orderWeeklyPickGames } from '../utils/weeklyPicks';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_HOUR = 60 * 60 * 1000;

interface WeeklyPicksWithGames {
  title: string | null;
  games: Game[];
}

const weeklyPicksKeys = {
  all: ['weekly-picks'] as const,
  withGames: (hideAiTranslations: boolean) =>
    [...weeklyPicksKeys.all, 'with-games', hideAiTranslations] as const,
};

export function useWeeklyPicks(hideAiTranslations: boolean) {
  return useSyncAwareQuery({
    queryKey: weeklyPicksKeys.withGames(hideAiTranslations),
    queryFn: async (): Promise<WeeklyPicksWithGames> => {
      const picks = await window.electronAPI.fetchWeeklyPicks();
      if (!picks) {
        // Throwing keeps the last good data while a refresh fails; with none, the section stays hidden
        throw new Error('No current weekly picks');
      }

      const games = await window.electronAPI.fetchGamesByIds(
        picks.gameIds,
        undefined,
        hideAiTranslations
      );
      return { title: picks.title, games: orderWeeklyPickGames(picks.gameIds, games) };
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    // The app turns this off globally; the launcher sits in the tray for days and a set rolls weekly
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
