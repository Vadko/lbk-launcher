import { create } from 'zustand';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';

interface WeeklyPicksStore {
  // undefined until the first read answers, null when there is no set
  picks: WeeklyPicks | null | undefined;
  setPicks: (picks: WeeklyPicks | null) => void;
  failRead: () => void;
}

export const useWeeklyPicksStore = create<WeeklyPicksStore>((set) => ({
  picks: undefined,
  setPicks: (picks) => set({ picks }),
  // A failed read keeps the set already shown
  failRead: () => set((state) => ({ picks: state.picks ?? null })),
}));
