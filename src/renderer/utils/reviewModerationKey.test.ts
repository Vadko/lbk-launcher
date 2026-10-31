import { describe, expect, it } from 'vitest';
import { reviewEvent } from './reviewEvent.fixture';
import { reviewModerationKey } from './reviewModerationKey';

describe('reviewModerationKey', () => {
  it('is the same for one verdict whichever offset its at was written with', () => {
    expect(
      reviewModerationKey(reviewEvent({ at: '2026-10-22T10:05:00.123+00:00' }))
    ).toBe(reviewModerationKey(reviewEvent({ at: '2026-10-22T12:05:00.123+02:00' })));
  });

  it('tells apart two rejected edits of one entry with the same editedAt', () => {
    const first = reviewEvent({ editRejected: true, at: '2026-10-22T10:05:00Z' });
    const second = reviewEvent({ editRejected: true, at: '2026-10-22T10:09:00Z' });

    expect(reviewModerationKey(first)).not.toBe(reviewModerationKey(second));
  });

  it('tells apart the verdicts on one entry', () => {
    const keys = [
      reviewEvent({ outcome: 'published' }),
      reviewEvent({ outcome: 'removed' }),
      reviewEvent({ editRejected: true }),
    ].map(reviewModerationKey);

    expect(new Set(keys).size).toBe(3);
  });
});
