import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { electronStorage } from './electronStorage';

interface OptimisticOffset {
  delta: number;
  baseCount: number;
}

/**
 * Client-side guard only — this machine can still be rate-limited server-side
 * too, but this stops accidental/scripted rapid toggling from spamming `track-like`.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ACTIONS = 15;

interface LikesStore {
  likedGameIds: string[];
  optimisticOffsets: Record<string, OptimisticOffset>;
  actionTimestamps: number[];
  isLiked: (gameId: string) => boolean;
  toggleLike: (gameId: string, serverCount: number) => void;
  getDisplayedCount: (gameId: string, serverCount: number) => number;
}

export const useLikesStore = create<LikesStore>()(
  persist(
    (set, get) => ({
      likedGameIds: [],
      optimisticOffsets: {},
      actionTimestamps: [],

      isLiked: (gameId) => get().likedGameIds.includes(gameId),

      toggleLike: (gameId, serverCount) => {
        const now = Date.now();
        const recentActions = get().actionTimestamps.filter(
          (t) => now - t < RATE_LIMIT_WINDOW_MS
        );
        if (recentActions.length >= RATE_LIMIT_MAX_ACTIONS) {
          console.warn('[Likes] Rate limit reached, ignoring toggle');
          return;
        }

        const liked = !get().likedGameIds.includes(gameId);

        set((state) => {
          const existing = state.optimisticOffsets[gameId];
          const prevDelta = existing?.baseCount === serverCount ? existing.delta : 0;
          const delta = prevDelta + (liked ? 1 : -1);

          const optimisticOffsets = { ...state.optimisticOffsets };
          if (delta === 0) {
            delete optimisticOffsets[gameId];
          } else {
            optimisticOffsets[gameId] = { delta, baseCount: serverCount };
          }

          return {
            likedGameIds: liked
              ? [...state.likedGameIds, gameId]
              : state.likedGameIds.filter((id) => id !== gameId),
            optimisticOffsets,
            actionTimestamps: [...recentActions, now],
          };
        });

        void window.electronAPI
          .trackLike(gameId, liked ? 'like' : 'unlike')
          .catch((error: unknown) => console.error('[Likes] Tracking failed:', error));
      },

      getDisplayedCount: (gameId, serverCount) => {
        const offset = get().optimisticOffsets[gameId];
        if (offset && offset.baseCount === serverCount) {
          return serverCount + offset.delta;
        }
        return serverCount;
      },
    }),
    {
      name: 'likes-storage',
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({
        likedGameIds: state.likedGameIds,
        optimisticOffsets: state.optimisticOffsets,
        actionTimestamps: state.actionTimestamps,
      }),
    }
  )
);
