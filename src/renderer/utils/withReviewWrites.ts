import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { GameReview, GameReviewEntry } from '@/shared/game-reviews-types';
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

// A reply whose parent the view hides falls back to the first level until the pages come again
function threadView(thread: GameReview, writes: ShownWrite[]): ReviewThreadView | null {
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
  const added = own.flatMap((state) =>
    state.write.kind === 'reply' &&
    !thread.replies.some((reply) => reply.id === state.write.entryId)
      ? (entryView(state.write.reply, state) ?? [])
      : []
  );
  return { ...root, replies: [...replies, ...added] };
}

// An answered write shows until pages fetched after its answer replace it; untouched threads keep their identity
export function withReviewWrites(
  data: ReviewPages,
  states: readonly ReviewWriteState[],
  dataUpdatedAt: number
): ReviewViewPages {
  const writes = states.filter(
    (state): state is ShownWrite =>
      state.write !== undefined &&
      (state.answer === null || dataUpdatedAt <= state.answer.answeredAt)
  );
  if (writes.length === 0) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((thread) => threadView(thread, writes) ?? []),
    })),
  };
}
