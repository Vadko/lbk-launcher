import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type {
  GameReview,
  GameReviewEntry,
  GameReviewReply,
} from '@/shared/game-reviews-types';
import type {
  ReviewThreadView,
  ReviewViewPages,
  ReviewWriteStatus,
} from '../queries/reviewViewTypes';
import type { ReviewPages } from './reviewCache';
import { withEdit } from './reviewEntryUpdates';

export type ReviewWriteDraft =
  | { kind: 'reply'; reviewId: string; reply: GameReviewReply }
  | { kind: 'edit'; text: string };

type ReviewWriteProgress =
  | { state: 'checking' }
  | { state: 'failed'; failure: ReviewFailure; resend: () => Promise<void> };

export type ReviewWrite = ReviewWriteDraft &
  ReviewWriteProgress & {
    // Fresh for every send, so an answer is applied only to the send it answers
    attempt: number;
  };

// The viewer's writes the server has not taken yet, keyed by entry id
export type GameReviewWrites = ReadonlyMap<string, ReviewWrite>;

export const NO_REVIEW_WRITES: GameReviewWrites = new Map();

function statusOf(write: ReviewWrite): ReviewWriteStatus {
  return write.state === 'failed'
    ? { write: write.kind, isChecking: false, failure: write.failure }
    : { write: write.kind, isChecking: true };
}

function entryView<T extends GameReviewEntry>(
  entry: T,
  write: ReviewWrite | undefined
): T & ReviewWriteStatus {
  if (!write) {
    return entry;
  }
  const shown = write.kind === 'edit' ? withEdit(entry, write.text) : entry;
  return { ...shown, ...statusOf(write) };
}

// Hands back the same array when no item changed, so memoized rows keep their props
function mapKept<T extends R, R>(items: T[], map: (item: T) => R): R[] {
  const mapped = items.map(map);
  return mapped.every((item, i) => item === items[i]) ? items : mapped;
}

function threadView(thread: GameReview, writes: GameReviewWrites): ReviewThreadView {
  const root = entryView(thread, writes.get(thread.id));
  const replies = mapKept(thread.replies, (reply) =>
    'removed' in reply ? reply : entryView(reply, writes.get(reply.id))
  );
  const added = [...writes.values()].flatMap((write) =>
    write.kind === 'reply' &&
    write.reviewId === thread.id &&
    !thread.replies.some((reply) => reply.id === write.reply.id)
      ? [entryView(write.reply, write)]
      : []
  );
  if (root === thread && replies === thread.replies && added.length === 0) {
    return thread;
  }
  return { ...root, replies: [...replies, ...added] };
}

// A write whose thread is not loaded waits in the overlay until a page brings that thread
export function applyOverlay(
  data: ReviewPages,
  writes: GameReviewWrites
): ReviewViewPages {
  if (writes.size === 0) {
    return data;
  }
  const pages = mapKept(data.pages, (page) => {
    const items = mapKept(page.items, (thread) => threadView(thread, writes));
    return items === page.items ? page : { ...page, items };
  });
  return pages === data.pages ? data : { ...data, pages };
}
