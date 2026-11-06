import { create } from 'zustand';
import type { GameRatingItem, TeamRatingItem } from '../../shared/ratings-api-types';

interface RatingsStore {
  teams: readonly TeamRatingItem[] | null;
  games: readonly GameRatingItem[] | null;
  failed: boolean;
  setRatings: (teams: TeamRatingItem[] | null, games: GameRatingItem[] | null) => void;
}

// A failed read keeps the list already shown
export const useRatingsStore = create<RatingsStore>((set) => ({
  teams: null,
  games: null,
  failed: false,
  setRatings: (teams, games) =>
    set((state) => ({
      teams: teams ?? state.teams,
      games: games ?? state.games,
      failed: teams === null || games === null,
    })),
}));
