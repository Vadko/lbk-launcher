import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { electronStorage } from './electronStorage';

interface OptimisticOffset {
  delta: number;
  baseCount: number;
}

interface LikesStore {
  likedGameIds: string[];
  optimisticOffsets: Record<string, OptimisticOffset>;
  isLiked: (gameId: string) => boolean;
  toggleLike: (gameId: string, serverCount: number) => void;
  getDisplayedCount: (gameId: string, serverCount: number) => number;
}

export const useLikesStore = create<LikesStore>()(
  persist(
    (set, get) => ({
      likedGameIds: [],
      optimisticOffsets: {},

      isLiked: (gameId) => get().likedGameIds.includes(gameId),

      toggleLike: (gameId, serverCount) => {
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
      partialize: (state) => ({ likedGameIds: state.likedGameIds }),
    }
  )
);
