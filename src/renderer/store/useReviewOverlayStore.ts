import { create } from 'zustand';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type {
  GameReviewWrites,
  ReviewWrite,
  ReviewWriteDraft,
} from '../utils/reviewOverlay';

type Games = ReadonlyMap<string, GameReviewWrites>;

interface ReviewOverlayStore {
  // In memory only, so a failed write outlives the tab and React Query's gc but not the session
  games: Games;
  writeOf: (gameId: string, entryId: string) => ReviewWrite | undefined;
  // Shows the write as checking and returns the attempt its answer has to match
  start: (gameId: string, entryId: string, draft: ReviewWriteDraft) => number;
  fail: (
    gameId: string,
    entryId: string,
    attempt: number,
    failure: ReviewFailure,
    resend: () => Promise<void>
  ) => void;
  // Without an attempt, drops the entry's write whichever send it is on
  drop: (gameId: string, entryId: string, attempt?: number) => void;
}

// Never reused, so an answer to a discarded write cannot pass for a later write on the same entry
let lastAttempt = 0;

// Only the changed game's slice gets a new identity; an emptied one goes, so its readers fall back to one constant
function withWrite(
  games: Games,
  gameId: string,
  entryId: string,
  write: ReviewWrite | null
): Games {
  const writes = new Map(games.get(gameId));
  if (write) {
    writes.set(entryId, write);
  } else {
    writes.delete(entryId);
  }
  const next = new Map(games);
  if (writes.size > 0) {
    next.set(gameId, writes);
  } else {
    next.delete(gameId);
  }
  return next;
}

export const useReviewOverlayStore = create<ReviewOverlayStore>((set, get) => ({
  games: new Map(),

  writeOf: (gameId, entryId) => get().games.get(gameId)?.get(entryId),

  start: (gameId, entryId, draft) => {
    const attempt = ++lastAttempt;
    set(({ games }) => ({
      games: withWrite(games, gameId, entryId, { ...draft, state: 'checking', attempt }),
    }));
    return attempt;
  },

  fail: (gameId, entryId, attempt, failure, resend) => {
    const write = get().writeOf(gameId, entryId);
    if (write?.attempt !== attempt) {
      return;
    }
    set(({ games }) => ({
      games: withWrite(games, gameId, entryId, {
        ...write,
        state: 'failed',
        failure,
        resend,
      }),
    }));
  },

  drop: (gameId, entryId, attempt) => {
    const write = get().writeOf(gameId, entryId);
    if (!write || (attempt !== undefined && write.attempt !== attempt)) {
      return;
    }
    set(({ games }) => ({ games: withWrite(games, gameId, entryId, null) }));
  },
}));
