import type { ReviewFailure } from '@/shared/game-reviews-api-types';

// A lost or garbled answer can follow a write the server stored
const OUTCOME_UNKNOWN: ReadonlySet<ReviewFailure['code']> = new Set([
  'unreachable',
  'bad_response',
  'internal',
]);

export function isOutcomeUnknown(failure: ReviewFailure): boolean {
  return OUTCOME_UNKNOWN.has(failure.code);
}
