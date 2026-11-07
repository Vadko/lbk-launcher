import { create } from 'zustand';
import type { Game } from '../../shared/types';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { withUpdatedGames } from '../utils/withUpdatedGames';

interface WeeklyPicksStore {
  // undefined until the first read answers, null when there is no set
  picks: WeeklyPicks | null | undefined;
  setPicks: (picks: WeeklyPicks | null) => void;
  failRead: () => void;
  updateGames: (games: readonly Game[]) => void;
}

export const useWeeklyPicksStore = create<WeeklyPicksStore>((set) => ({
  picks: undefined,
  setPicks: (picks) => set({ picks }),
  // A failed read keeps the set already shown
  failRead: () => set((state) => ({ picks: state.picks ?? null })),
  updateGames: (updated) =>
    set((state) => {
      if (!state.picks) {
        return state;
      }
      const games = withUpdatedGames(state.picks.games, updated);
      return games === state.picks.games ? state : { picks: { ...state.picks, games } };
    }),
}));
