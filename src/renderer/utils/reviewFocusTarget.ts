import type { GameReview } from '@/shared/game-reviews-types';
import type { ReviewLinkFocus } from './readReviewLink';

export interface ReviewFocusTarget {
  threadId: string;
  // The linked entry, or the thread's own when that entry is no longer shown
  entryId: string;
  isEntryShown: boolean;
}

// Null when the server no longer shows the thread at all
export function reviewFocusTarget(
  threads: ReadonlyArray<GameReview>,
  { feedbackId, entryId }: ReviewLinkFocus
): ReviewFocusTarget | null {
  const thread = threads.find((item) => item.id === feedbackId);
  if (!thread) {
    return null;
  }
  const isEntryShown =
    entryId === thread.id ||
    thread.replies.some((reply) => reply.id === entryId && !('removed' in reply));
  return {
    threadId: thread.id,
    entryId: isEntryShown ? entryId : thread.id,
    isEntryShown,
  };
}
