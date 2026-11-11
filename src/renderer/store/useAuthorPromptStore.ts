import { create } from 'zustand';
import type { Game } from '@/shared/types';
import { useSubscriptionsStore } from './useSubscriptionsStore';

interface AuthorPromptStore {
  // The game whose page offers to follow its team, after its first install
  gameId: string | null;
  offer: (game: Game) => void;
  dismiss: () => void;
}

export const useAuthorPromptStore = create<AuthorPromptStore>((set) => ({
  gameId: null,
  offer: (game) => {
    if (game.team && !useSubscriptionsStore.getState().isGamePrompted(game.id)) {
      set({ gameId: game.id });
    }
  },
  dismiss: () => set({ gameId: null }),
}));
