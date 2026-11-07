import { create } from 'zustand';
import type { Game } from '../../shared/types';
import { withUpdatedGames } from '../utils/withUpdatedGames';

interface HomeInstalledGamesStore {
  games: readonly Game[] | null;
  installedPathsCount: number;
  setInstalledGames: (games: readonly Game[], installedPathsCount: number) => void;
  updateGames: (games: readonly Game[]) => void;
}

export const useHomeInstalledGamesStore = create<HomeInstalledGamesStore>((set) => ({
  games: null,
  installedPathsCount: 0,
  setInstalledGames: (games, installedPathsCount) => set({ games, installedPathsCount }),
  updateGames: (updated) =>
    set((state) => {
      const games = state.games && withUpdatedGames(state.games, updated);
      return games === state.games ? state : { games };
    }),
}));
