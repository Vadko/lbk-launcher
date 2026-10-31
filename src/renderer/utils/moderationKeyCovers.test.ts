import { describe, expect, it } from 'vitest';
import { moderationKeyCovers } from './moderationKeyCovers';
import { reviewEvent } from './reviewEvent.fixture';
import { reviewModerationKey } from './reviewModerationKey';

const published = reviewEvent({ at: '2026-10-22T10:07:00Z' });
const key = reviewModerationKey(published);

describe('moderationKeyCovers', () => {
  it('covers a repeat of the claimed event', () => {
    expect(
      moderationKeyCovers(key, { ...published, at: '2026-10-22T12:07:00+02:00' })
    ).toBe(true);
  });

  it('covers an older verdict on the same entry', () => {
    expect(
      moderationKeyCovers(
        key,
        reviewEvent({ outcome: 'removed', at: '2026-10-22T10:06:00Z' })
      )
    ).toBe(true);
  });

  it('leaves a newer verdict on the same entry', () => {
    expect(
      moderationKeyCovers(
        key,
        reviewEvent({ outcome: 'removed', at: '2026-10-22T10:08:00Z' })
      )
    ).toBe(false);
  });

  it('leaves another entry, even one whose id starts the same', () => {
    expect(moderationKeyCovers(key, { ...published, entryId: 'hel' })).toBe(false);
    expect(moderationKeyCovers(key, { ...published, entryId: 'held2' })).toBe(false);
  });
});
