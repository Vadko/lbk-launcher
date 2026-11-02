import { describe, expect, it } from 'vitest';
import { moderationVerdict } from './moderationVerdict';
import { reviewEvent } from './reviewEvent.fixture';

describe('moderationVerdict', () => {
  it.each([
    [{ outcome: 'removed' as const }, 'removed'],
    [{ outcome: 'removed' as const, editRejected: true }, 'removed'],
    [{ outcome: 'published' as const, editRejected: true }, 'rolledBack'],
    [{ outcome: 'published' as const }, 'published'],
    [{ outcome: 'pending' as const }, 'pending'],
  ])('reads %o as %s', (extra, verdict) => {
    expect(moderationVerdict(reviewEvent(extra))).toBe(verdict);
  });
});
