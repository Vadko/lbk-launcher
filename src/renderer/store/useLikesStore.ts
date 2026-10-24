import { create } from 'zustand';

interface LikesStore {
  likedGameIds: ReadonlySet<string>;
  // Clicks main has not answered yet, per game; pushes answering earlier clicks would undo later ones there
  pendingClicks: Record<string, number>;
  setLikedGameIds: (gameIds: string[]) => void;
  toggleLike: (gameId: string) => void;
}

// Main owns the liked set, the like counts and the server queue; this mirrors the set for rendering
export const useLikesStore = create<LikesStore>((set, get) => ({
  likedGameIds: new Set(),
  pendingClicks: {},

  setLikedGameIds: (gameIds) => {
    set((state) => {
      const next = new Set(gameIds);
      for (const gameId of Object.keys(state.pendingClicks)) {
        withLike(next, gameId, state.likedGameIds.has(gameId));
      }
      return { likedGameIds: next };
    });
  },

  toggleLike: (gameId) => {
    const liked = !get().likedGameIds.has(gameId);
    set((state) => ({
      likedGameIds: withLike(new Set(state.likedGameIds), gameId, liked),
      pendingClicks: {
        ...state.pendingClicks,
        [gameId]: (state.pendingClicks[gameId] ?? 0) + 1,
      },
    }));
    // A failed call leaves main unable to say what it holds, so the click is shown as undone
    void window.electronAPI.setLike(gameId, liked).then(
      (gameIds) => settleClick(set, gameId, gameIds.includes(gameId)),
      () => settleClick(set, gameId, !liked)
    );
  },
}));

type Set_ = (fn: (state: LikesStore) => Partial<LikesStore>) => void;

function withLike(gameIds: Set<string>, gameId: string, liked: boolean): Set<string> {
  if (liked) {
    gameIds.add(gameId);
  } else {
    gameIds.delete(gameId);
  }
  return gameIds;
}

// The answer to the last click carries main's current state, so that game takes it again
function settleClick(set: Set_, gameId: string, liked: boolean): void {
  set((state) => {
    const pendingClicks = { ...state.pendingClicks };
    const left = (pendingClicks[gameId] ?? 1) - 1;
    if (left > 0) {
      pendingClicks[gameId] = left;
      return { pendingClicks };
    }
    delete pendingClicks[gameId];
    return {
      pendingClicks,
      likedGameIds: withLike(new Set(state.likedGameIds), gameId, liked),
    };
  });
}
