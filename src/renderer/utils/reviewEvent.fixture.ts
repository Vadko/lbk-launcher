import type { ReviewEvent } from '@/shared/game-reviews-types';

export const reviewEvent = (extra: Partial<ReviewEvent> = {}): ReviewEvent => ({
  kind: 'moderation',
  gameId: 'g1',
  gameName: 'Game',
  feedbackId: 't',
  entryId: 'held',
  parentId: null,
  authorName: 'Nick',
  authorRole: 'player',
  message: null,
  outcome: 'published',
  editRejected: false,
  createdAt: '2026-10-22T10:01:00.000Z',
  editedAt: null,
  at: '2026-10-22T10:05:00.123456+00:00',
  ...extra,
});
