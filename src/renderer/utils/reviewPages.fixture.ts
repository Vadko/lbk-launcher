import type {
  GameReview,
  GameReviewReply,
  GameReviewThreadReply,
} from '@/shared/game-reviews-types';
import type { ReviewPages } from './reviewCache';

export const reviewAt = (minute: number) =>
  new Date(Date.UTC(2026, 9, 22, 10, minute)).toISOString();

export const reviewReply = (id: string, minute = 1): GameReviewReply => ({
  id,
  parentId: null,
  text: id,
  createdAt: reviewAt(minute),
  editedAt: null,
  author: { role: 'player', name: id, avatarSeed: id, isMine: false },
  moderation: 'published',
  pendingText: null,
});

export const removedReply = (id: string): GameReviewThreadReply => ({
  id,
  parentId: null,
  createdAt: reviewAt(2),
  removed: true,
});

export const reviewThread = (
  id: string,
  replies: GameReviewThreadReply[] = [],
  isPublic = true
): GameReview => ({
  ...reviewReply(id, 0),
  type: 'feedback',
  isPublic,
  screenshots: [],
  replies,
});

export const reviewPages = (...items: GameReview[][]): ReviewPages => ({
  pages: items.map((page) => ({ items: page, total: 9, nextCursor: null, viewer: null })),
  pageParams: items.map(() => null),
});
