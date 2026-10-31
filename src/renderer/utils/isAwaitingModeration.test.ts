import { describe, expect, it } from 'vitest';
import { isAwaitingModeration } from './isAwaitingModeration';
import { reviewReply } from './reviewPages.fixture';

describe('isAwaitingModeration', () => {
  it('holds for a pending entry and for a published one with an edit under moderation', () => {
    expect(isAwaitingModeration({ ...reviewReply('a'), moderation: 'pending' })).toBe(
      true
    );
    expect(isAwaitingModeration({ ...reviewReply('a'), pendingText: 'new' })).toBe(true);
    expect(isAwaitingModeration(reviewReply('a'))).toBe(false);
  });
});
