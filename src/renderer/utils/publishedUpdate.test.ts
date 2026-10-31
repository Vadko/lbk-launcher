import { describe, expect, it } from 'vitest';
import { publishedUpdate } from './publishedUpdate';
import { reviewEvent } from './reviewEvent.fixture';
import { reviewReply } from './reviewPages.fixture';

describe('publishedUpdate', () => {
  it('publishes a pending entry with the text the server published', () => {
    const entry = { ...reviewReply('held'), moderation: 'pending' as const };

    expect(publishedUpdate(reviewEvent({ message: 'held' }))(entry)).toEqual({
      ...entry,
      moderation: 'published',
    });
  });

  it('turns an edit under moderation into the shown text', () => {
    const entry = { ...reviewReply('held'), pendingText: 'changed' };
    const editedAt = '2026-10-22T10:04:00+00:00';

    expect(publishedUpdate(reviewEvent({ message: 'changed', editedAt }))(entry)).toEqual(
      {
        ...entry,
        text: 'changed',
        pendingText: null,
        editedAt,
      }
    );
  });

  it('hands back the same entry when the verdict is already in place', () => {
    const update = publishedUpdate(reviewEvent({ message: 'changed' }));
    const once = update({ ...reviewReply('held'), moderation: 'pending' });

    expect(once && update(once)).toBe(once);
  });
});
