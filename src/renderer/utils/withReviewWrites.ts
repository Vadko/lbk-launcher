import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type {
  GameReview,
  GameReviewEntry,
  GameReviewReply,
} from '@/shared/game-reviews-types';
import type {
  ReviewThreadReplyView,
  ReviewThreadView,
  ReviewViewPages,
  ReviewWriteStatus,
} from '../queries/reviewViewTypes';
import type {
  ReviewAnswer,
  ReviewWrite,
  ReviewWriteMutation,
} from '../queries/reviewWrite';
import type { ReviewPages } from './reviewCache';

// A review write as useMutationState reads it: still checking, failed, or answered
export interface ReviewWriteState {
  write: ReviewWrite | undefined;
  failure: ReviewFailure | null;
  answer: ReviewAnswer | null;
}

// Plain data, so useMutationState hands back the same states while no write changes
export const reviewWriteState = ({ state }: ReviewWriteMutation): ReviewWriteState => ({
  write: state.variables,
  failure: state.error?.failure ?? null,
  answer: state.data ?? null,
});

interface ShownWrite extends ReviewWriteState {
  write: ReviewWrite;
}

// A published entry keeps showing its edit beside the old text until moderation answers
function withEdit<T extends GameReviewEntry>(entry: T, text: string): T {
  return entry.moderation === 'published'
    ? { ...entry, pendingText: text }
    : { ...entry, text };
}

function afterEdit<T extends GameReviewEntry>(
  entry: T,
  outcome: 'published' | 'pending',
  text: string,
  answeredAt: number
): T {
  if (outcome === 'pending' && entry.moderation === 'published') {
    return { ...entry, pendingText: text };
  }
  return {
    ...entry,
    text,
    pendingText: null,
    moderation: outcome,
    editedAt:
      entry.moderation === 'published'
        ? new Date(answeredAt).toISOString()
        : entry.editedAt,
  };
}

// Null hides the entry: the server removed it, or refused a reply and stored nothing
function answered<T extends GameReviewEntry>(
  entry: T,
  write: ReviewWrite,
  { verdict, answeredAt }: ReviewAnswer
): (T & ReviewWriteStatus) | null {
  if (verdict === 'removed' || (verdict === null && write.kind === 'reply')) {
    return null;
  }
  if (verdict === null) {
    return { ...entry, isRolledBack: true };
  }
  // Moderation refused the edit, so the entry keeps the text everyone already sees
  if (verdict === 'rolledBack') {
    return { ...entry, pendingText: null, isRolledBack: true };
  }
  return write.kind === 'reply'
    ? { ...entry, moderation: verdict }
    : afterEdit(entry, verdict, write.text, answeredAt);
}

function entryView<T extends GameReviewEntry>(
  entry: T,
  { write, failure, answer }: ShownWrite
): (T & ReviewWriteStatus) | null {
  if (answer) {
    return answered(entry, write, answer);
  }
  const shown = write.kind === 'edit' ? withEdit(entry, write.text) : entry;
  return failure
    ? { ...shown, write: write.kind, failure }
    : { ...shown, write: write.kind, isChecking: true };
}

// A new reply, or the one an edit carries while the page was asked for before that reply's answer
function addedReply(write: ReviewWrite, fetchedAt: number): GameReviewReply | null {
  if (write.kind === 'reply') {
    return write.reply;
  }
  return write.unlisted && fetchedAt < write.unlisted.answeredAt
    ? write.unlisted.reply
    : null;
}

// A reply whose parent the view hides falls back to the first level until the pages come again
function threadView(
  thread: GameReview,
  writes: ShownWrite[],
  fetchedAt: number
): ReviewThreadView | null {
  const own = writes.filter(({ write }) => write.reviewId === thread.id);
  if (own.length === 0) {
    return thread;
  }
  const writeOf = (id: string) => own.find(({ write }) => write.entryId === id);
  const rootWrite = writeOf(thread.id);
  const root = rootWrite ? entryView(thread, rootWrite) : thread;
  if (!root) {
    return null;
  }
  const replies = thread.replies.flatMap((reply): ReviewThreadReplyView[] => {
    if ('removed' in reply) {
      return [reply];
    }
    const replyWrite = writeOf(reply.id);
    const shown = replyWrite ? entryView(reply, replyWrite) : reply;
    return shown ? [shown] : [];
  });
  const added = own.flatMap((state) => {
    const reply = addedReply(state.write, fetchedAt);
    return reply && !thread.replies.some(({ id }) => id === reply.id)
      ? (entryView(reply, state) ?? [])
      : [];
  });
  return { ...root, replies: [...replies, ...added] };
}

// An answered write shows on a page asked for before its answer; untouched pages and threads keep their identity
export function withReviewWrites(
  data: ReviewPages,
  states: readonly ReviewWriteState[]
): ReviewViewPages {
  const writes = states.filter((state): state is ShownWrite => state.write !== undefined);
  const pages = data.pages.map((page) => {
    const shown = writes.filter(
      ({ answer }) => answer === null || page.fetchedAt < answer.answeredAt
    );
    return shown.length === 0
      ? page
      : {
          ...page,
          items: page.items.flatMap(
            (thread) => threadView(thread, shown, page.fetchedAt) ?? []
          ),
        };
  });
  return pages.every((page, i) => page === data.pages[i]) ? data : { ...data, pages };
}
