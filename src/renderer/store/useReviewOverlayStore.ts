import { create } from 'zustand';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { ModerationVerdict } from '../utils/moderationVerdict';
import type {
  GameReviewWrites,
  ReviewWrite,
  ReviewWriteDraft,
} from '../utils/reviewOverlay';

type Games = ReadonlyMap<string, GameReviewWrites>;

type RolledBack = ReadonlyMap<string, ReadonlySet<string>>;

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
  // Entries whose edit the server refused, by game, until a new write on them starts
  rolledBack: RolledBack;
  // Marks the entry and drops the answered attempt's write in one update, so the badge never sees it confirmed; another write stays
  rollBack: (gameId: string, entryId: string, attempt?: number) => void;
  // Root posts the feedback form sent and the server has not answered yet, by id
  posting: ReadonlySet<string>;
  startPost: (id: string) => void;
  endPost: (id: string, shown: ModerationVerdict | null) => void;
  // The verdict each answer to the viewer's own write showed, until a moderation event on that entry takes it
  shown: ReadonlyMap<string, ModerationVerdict>;
  markShown: (entryId: string, verdict: ModerationVerdict) => void;
  takeShown: (entryId: string) => ModerationVerdict | undefined;
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

function withShown(
  shown: ReadonlyMap<string, ModerationVerdict>,
  entryId: string,
  verdict: ModerationVerdict | null
): ReadonlyMap<string, ModerationVerdict> {
  const next = new Map(shown);
  if (verdict) {
    next.set(entryId, verdict);
  } else {
    next.delete(entryId);
  }
  return next;
}

function withRolledBack(
  rolledBack: RolledBack,
  gameId: string,
  entryId: string,
  isRolledBack: boolean
): RolledBack {
  if (rolledBack.get(gameId)?.has(entryId) === isRolledBack) {
    return rolledBack;
  }
  const entries = new Set(rolledBack.get(gameId));
  if (isRolledBack) {
    entries.add(entryId);
  } else {
    entries.delete(entryId);
  }
  const next = new Map(rolledBack);
  if (entries.size > 0) {
    next.set(gameId, entries);
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
    set(({ games, rolledBack }) => ({
      games: withWrite(games, gameId, entryId, { ...draft, state: 'checking', attempt }),
      rolledBack: withRolledBack(rolledBack, gameId, entryId, false),
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

  rolledBack: new Map(),

  rollBack: (gameId, entryId, attempt) => {
    set(({ games, rolledBack }) => ({
      games:
        attempt !== undefined && get().writeOf(gameId, entryId)?.attempt === attempt
          ? withWrite(games, gameId, entryId, null)
          : games,
      rolledBack: withRolledBack(rolledBack, gameId, entryId, true),
    }));
  },

  posting: new Set(),

  startPost: (id) => {
    set(({ posting }) => ({ posting: new Set(posting).add(id) }));
  },

  // One update, so a verdict waiting for the answer already sees what it showed
  endPost: (id, verdict) => {
    set(({ posting, shown }) => {
      const rest = new Set(posting);
      rest.delete(id);
      return { posting: rest, shown: verdict ? withShown(shown, id, verdict) : shown };
    });
  },

  shown: new Map(),

  markShown: (entryId, verdict) => {
    set(({ shown }) => ({ shown: withShown(shown, entryId, verdict) }));
  },

  takeShown: (entryId) => {
    const verdict = get().shown.get(entryId);
    if (verdict) {
      set(({ shown }) => ({ shown: withShown(shown, entryId, null) }));
    }
    return verdict;
  },
}));
