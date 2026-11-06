import { F } from '@mobily/ts-belt';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { orderWeeklyPickGames } from '../utils/weeklyPicks';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_HOUR = 60 * 60 * 1000;
// A bulk catalog update broadcasts one event per game
const CATALOG_RELOAD_DEBOUNCE = 300;

const weeklyPicksKeys = {
  all: ['weekly-picks'] as const,
  set: () => [...weeklyPicksKeys.all, 'set'] as const,
  games: () => [...weeklyPicksKeys.all, 'games'] as const,
  gamesOf: (gameIds: readonly string[], hideAiTranslations: boolean) =>
    [...weeklyPicksKeys.games(), gameIds, hideAiTranslations] as const,
};

export function useWeeklyPicks(hideAiTranslations: boolean) {
  const queryClient = useQueryClient();
  const set = useQuery({
    queryKey: weeklyPicksKeys.set(),
    queryFn: async () => {
      const result = await window.electronAPI.fetchWeeklyPicks();
      if (!result.success) {
        // Throwing keeps the last good set while a refresh fails
        throw new Error(result.error);
      }
      return result.picks;
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    // The app turns this off globally; the launcher sits in the tray for days and a set rolls weekly
    refetchOnWindowFocus: true,
  });
  const gameIds = set.data?.gameIds ?? [];
  const hasGames = gameIds.length > 0;
  const games = useSyncAwareQuery({
    queryKey: weeklyPicksKeys.gamesOf(gameIds, hideAiTranslations),
    queryFn: async () =>
      orderWeeklyPickGames(
        gameIds,
        await window.electronAPI.fetchGamesByIds(gameIds, undefined, hideAiTranslations)
      ),
    enabled: hasGames,
    // A local database read; paused offline it would keep the section on its loader
    networkMode: 'always',
  });

  useEffect(() => {
    const reload = F.makeControlledDebounce(
      () => {
        void queryClient.invalidateQueries({ queryKey: weeklyPicksKeys.games() });
      },
      { delay: CATALOG_RELOAD_DEBOUNCE, leading: false }
    );
    const offUpdated = window.electronAPI.onGameUpdated(reload.schedule);
    const offRemoved = window.electronAPI.onGameRemoved(reload.schedule);
    return () => {
      offUpdated();
      offRemoved();
      reload.cancel();
    };
  }, [queryClient]);

  return {
    picks: set.data,
    games: games.data ?? [],
    // Only the first attempt shows the placeholder, so refetches after a failure stay hidden
    isLoading: (set.isLoading && !set.isFetched) || (hasGames && games.isPending),
  };
}
