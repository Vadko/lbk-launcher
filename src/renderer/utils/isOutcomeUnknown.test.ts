import { describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import { isOutcomeUnknown } from './isOutcomeUnknown';

describe('isOutcomeUnknown', () => {
  it.each([
    [{ code: 'unreachable', kind: 'retry' }, true],
    [{ code: 'bad_response', kind: 'retry' }, true],
    [{ code: 'internal', kind: 'retry' }, true],
    [{ code: 'rate_limit', kind: 'retry' }, false],
    [{ code: 'author_required', kind: 'needs-author' }, false],
    [{ code: 'banned', kind: 'rejected' }, false],
  ] satisfies [ReviewFailure, boolean][])('%o is unknown: %s', (failure, unknown) => {
    expect(isOutcomeUnknown(failure)).toBe(unknown);
  });
});
