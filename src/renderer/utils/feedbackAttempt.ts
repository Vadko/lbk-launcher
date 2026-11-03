import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { FeedbackType } from '@/shared/types';
import { isOutcomeUnknown } from './isOutcomeUnknown';

export interface FeedbackContent {
  type: FeedbackType;
  message: string;
  files: readonly File[];
  allowPublish: boolean;
}

// The post's id and uploads; content sent without a clear answer may already be stored under that id
export interface FeedbackAttempt {
  id: string;
  uploads: ReadonlyMap<File, string>;
  unconfirmed: FeedbackContent | null;
}

export function freshAttempt(): FeedbackAttempt {
  return { id: crypto.randomUUID(), uploads: new Map(), unconfirmed: null };
}

function isSameContent(a: FeedbackContent, b: FeedbackContent): boolean {
  return (
    a.type === b.type &&
    a.message === b.message &&
    a.allowPublish === b.allowPublish &&
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
