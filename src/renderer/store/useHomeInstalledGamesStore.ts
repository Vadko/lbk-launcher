import { create } from 'zustand';
import type { Game } from '../../shared/types';

interface HomeInstalledGamesStore {
  games: Game[] | null;
  installedPathsCount: number;
  setInstalledGames: (games: Game[], installedPathsCount: number) => void;
}

export const useHomeInstalledGamesStore = create<HomeInstalledGamesStore>((set) => ({
  games: null,
  installedPathsCount: 0,
  setInstalledGames: (games, installedPathsCount) => set({ games, installedPathsCount }),
}));
