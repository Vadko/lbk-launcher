import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { FeedbackType } from '@/shared/types';
import { isOutcomeUnknown } from './isOutcomeUnknown';

interface FeedbackContent {
  type: FeedbackType;
  message: string;
  files: readonly File[];
}

export interface FeedbackAttempt {
  id: string;
  // Paths uploaded under this id; the server takes them only for a post with this id
  uploads: ReadonlyMap<File, string>;
  // Content sent without a clear answer: the server may already hold it under this id
  unconfirmed: FeedbackContent | null;
}

export function freshAttempt(): FeedbackAttempt {
  return { id: crypto.randomUUID(), uploads: new Map(), unconfirmed: null };
}

function isSameContent(a: FeedbackContent, b: FeedbackContent): boolean {
  return (
    a.type === b.type &&
    a.message === b.message &&
    a.files.length === b.files.length &&
    a.files.every((file, i) => file === b.files[i])
  );
}

// The server answers a stored id with that post and ignores new content, so changed content takes a new id
export function attemptFor(
  attempt: FeedbackAttempt,
  content: FeedbackContent
): FeedbackAttempt {
  return attempt.unconfirmed && !isSameContent(attempt.unconfirmed, content)
    ? freshAttempt()
    : attempt;
}

export function afterRefusal(
  attempt: FeedbackAttempt,
  content: FeedbackContent,
  failure: ReviewFailure
): FeedbackAttempt {
  return isOutcomeUnknown(failure) ? { ...attempt, unconfirmed: content } : attempt;
}
