import type { InfiniteData } from '@tanstack/react-query';
import type {
  GameReview,
  GameReviewEntry,
  GameReviewReply,
  GameReviewsPage,
  GameReviewThreadReply,
} from '@/shared/game-reviews-types';

export type ReviewPages = InfiniteData<GameReviewsPage, string | null>;

// null removes the entry; a removed root takes its whole thread with it
export type EntryUpdate = (entry: GameReviewEntry) => GameReviewEntry | null;

interface FoundEntry {
  thread: GameReview;
  entry: GameReviewEntry;
}

function threads(data: ReviewPages): GameReview[] {
  return data.pages.flatMap((page) => page.items);
}

function mapThreads(
  data: ReviewPages,
  map: (thread: GameReview) => GameReview[]
): ReviewPages {
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.flatMap(map) })),
  };
}

export function findEntry(
  data: ReviewPages | undefined,
  entryId: string
): FoundEntry | null {
  for (const thread of data ? threads(data) : []) {
    if (thread.id === entryId) {
      return { thread, entry: thread };
    }
    const reply = thread.replies.find((item) => item.id === entryId);
    if (reply && !('removed' in reply)) {
      return { thread, entry: reply };
    }
  }
  return null;
}

export function updateEntry(
  data: ReviewPages,
  entryId: string,
  update: EntryUpdate
): ReviewPages {
  const updateReply = (reply: GameReviewThreadReply): GameReviewThreadReply[] => {
    if (reply.id !== entryId || 'removed' in reply) {
      return [reply];
    }
    const next = update(reply);
    return next ? [{ ...reply, ...next }] : [];
  };
  return mapThreads(data, (thread) => {
    if (thread.id !== entryId) {
      return [{ ...thread, replies: thread.replies.flatMap(updateReply) }];
    }
    const next = update(thread);
    return next ? [{ ...thread, ...next }] : [];
  });
}

export function appendReply(
  data: ReviewPages,
  reviewId: string,
  reply: GameReviewReply
): ReviewPages {
  return mapThreads(data, (thread) => [
    thread.id === reviewId ? { ...thread, replies: [...thread.replies, reply] } : thread,
  ]);
}

// A clock behind the server's would date a new reply before the ones it follows
export function nextReplyTime(thread: GameReview | undefined, now: number): string {
  const latest = Math.max(
    0,
    ...[thread, ...(thread?.replies ?? [])].map((item) =>
      item ? Date.parse(item.createdAt) : 0
    )
  );
  return new Date(Math.max(now, latest + 1)).toISOString();
}

export function findThread(
  data: ReviewPages | undefined,
  reviewId: string
): GameReview | undefined {
  return data ? threads(data).find((thread) => thread.id === reviewId) : undefined;
}
