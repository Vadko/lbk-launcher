import { describe, expect, it } from 'vitest';
import type { GameReviewReply } from '@/shared/game-reviews-types';
import { handOver } from './handOver';
import type { ReviewPages } from './reviewCache';
import type { ReviewWriteDraft } from './reviewOverlay';
import { reviewPages, reviewReply, reviewThread } from './reviewPages.fixture';

const NOW = '2026-10-26T12:00:00.000Z';

const replyDraft = (id: string): ReviewWriteDraft => ({
  kind: 'reply',
  reviewId: 'a',
  reply: { ...reviewReply(id, 30), moderation: 'pending' },
});

const base = (moderation: GameReviewReply['moderation'] = 'published') =>
  reviewPages([reviewThread('a', [{ ...reviewReply('r1'), moderation }])]);

const replies = (data: ReviewPages) =>
  data.pages[0]?.items[0]?.replies.map((reply) => [
    reply.id,
    'removed' in reply ? null : reply.moderation,
  ]);

describe('handOver', () => {
  it.each([
    [
      'published',
      [
        ['r1', 'published'],
        ['new', 'published'],
      ],
    ],
    [
      'pending',
      [
        ['r1', 'published'],
        ['new', 'pending'],
      ],
    ],
    ['removed', [['r1', 'published']]],
  ] as const)('settles a %s reply in the cache', (outcome, expected) => {
    expect(replies(handOver(base(), 'new', replyDraft('new'), outcome, NOW))).toEqual(
      expected
    );
  });

  it.each([
    ['published', [['r1', 'published']]],
    ['removed', []],
  ] as const)(
    'gives a %s verdict to the pending copy a refetch already brought',
    (outcome, expected) => {
      const data = base('pending');

      expect(replies(handOver(data, 'r1', replyDraft('r1'), outcome, NOW))).toEqual(
        expected
      );
    }
  );

  it('applies a taken edit to the cached entry', () => {
    const next = handOver(
      base(),
      'r1',
      { kind: 'edit', text: 'changed' },
      'published',
      NOW
    );

    expect(next.pages[0]?.items[0]?.replies[0]).toMatchObject({
      text: 'changed',
      editedAt: NOW,
    });
  });
});
