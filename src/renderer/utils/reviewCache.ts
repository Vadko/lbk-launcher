import type { InfiniteData } from '@tanstack/react-query';
import type {
  GameReview,
  GameReviewEntry,
  GameReviewRemovedReply,
  GameReviewReply,
  GameReviewsPage,
  GameReviewThreadReply,
  ReviewAuthorIdentity,
} from '@/shared/game-reviews-types';

export type ReviewPages = InfiniteData<GameReviewsPage, string | null>;

// null is a removal as get_game_reviews shows one: a root takes its thread, a reply leaves a stub only above a visible reply
export type EntryUpdate = (entry: GameReviewEntry) => GameReviewEntry | null;

interface FoundEntry {
  thread: GameReview;
  entry: GameReviewEntry;
}

function threads(data: ReviewPages): GameReview[] {
  return data.pages.flatMap((page) => page.items);
}

const sameItems = <T>(next: T[], items: T[]) =>
  next.length === items.length && next.every((item, i) => item === items[i]);

// Untouched threads and pages keep their identity, so memoized threads skip the render
function mapThreads(
  data: ReviewPages,
  map: (thread: GameReview) => GameReview | null
): ReviewPages {
  const pages = data.pages.map((page) => {
    const items = page.items.flatMap((thread) => map(thread) ?? []);
    return sameItems(items, page.items) ? page : { ...page, items };
  });
  return sameItems(pages, data.pages) ? data : { ...data, pages };
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

// Stubs are kept only while a visible reply hangs somewhere under them
function withoutBareStubs(replies: GameReviewThreadReply[]): GameReviewThreadReply[] {
  const parents = new Map(replies.map((reply) => [reply.id, reply.parentId]));
  const holding = new Set<string>();
  for (const reply of replies) {
    if ('removed' in reply) {
      continue;
    }
    let parentId = reply.parentId;
    while (parentId !== null && !holding.has(parentId)) {
      holding.add(parentId);
      parentId = parents.get(parentId) ?? null;
    }
  }
  return replies.filter((reply) => !('removed' in reply) || holding.has(reply.id));
}

function removedReply({
  id,
  parentId,
  createdAt,
}: GameReviewReply): GameReviewRemovedReply {
  return { id, parentId, createdAt, removed: true };
}

function updateReply(
  thread: GameReview,
  entryId: string,
  update: EntryUpdate
): GameReview {
  const reply = thread.replies.find((item) => item.id === entryId);
  if (!reply || 'removed' in reply) {
    return thread;
  }
  const next = update(reply);
  if (next === reply) {
    return thread;
  }
  const replies = thread.replies.map((item) =>
    item !== reply ? item : next ? { ...reply, ...next } : removedReply(reply)
  );
  return { ...thread, replies: next ? replies : withoutBareStubs(replies) };
}

export function updateEntry(
  data: ReviewPages,
  entryId: string,
  update: EntryUpdate
): ReviewPages {
  return mapThreads(data, (thread) => {
    if (thread.id !== entryId) {
      return updateReply(thread, entryId, update);
    }
    const next = update(thread);
    if (!next) {
      return null;
    }
    return next === thread ? thread : { ...thread, ...next };
  });
}

// A reply a refetch already brought keeps the server's copy
export function appendReply(
  data: ReviewPages,
  reviewId: string,
  reply: GameReviewReply
): ReviewPages {
  return mapThreads(data, (thread) =>
    thread.id === reviewId && !thread.replies.some((item) => item.id === reply.id)
      ? { ...thread, replies: [...thread.replies, reply] }
      : thread
  );
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

// A nickname claimed after the pages loaded; an optimistic write reads it from the first page
export function withViewer(data: ReviewPages, viewer: ReviewAuthorIdentity): ReviewPages {
  return { ...data, pages: data.pages.map((page) => ({ ...page, viewer })) };
}
