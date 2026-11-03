import { describe, expect, it } from 'vitest';
import type { GameReview, GameReviewThreadReply } from '@/shared/game-reviews-types';
import { reviewFocusTarget } from './reviewFocusTarget';

const CREATED = '2026-10-22T10:00:00.000Z';

const author = {
  role: 'player',
  name: 'Quiet Owl',
  avatarSeed: 'seed',
  isMine: false,
} as const;

const reply = (id: string): GameReviewThreadReply => ({
  id,
  text: id,
  createdAt: CREATED,
  editedAt: null,
  author,
  moderation: 'published',
  pendingText: null,
  parentId: null,
});

const thread = (id: string, replies: GameReviewThreadReply[] = []): GameReview => ({
  id,
  text: id,
  createdAt: CREATED,
  editedAt: null,
  author,
  moderation: 'published',
  pendingText: null,
  type: 'feedback',
  isPublic: true,
  screenshots: [],
  replies,
});

const threads = [
  thread('a'),
  thread('b', [
    reply('r1'),
    { id: 'gone', parentId: null, createdAt: CREATED, removed: true },
  ]),
];

describe('reviewFocusTarget', () => {
  it('targets a reply in its thread', () => {
    expect(reviewFocusTarget(threads, { feedbackId: 'b', entryId: 'r1' })).toEqual({
      threadId: 'b',
      entryId: 'r1',
      isEntryShown: true,
    });
  });

  it('targets the review itself', () => {
    expect(reviewFocusTarget(threads, { feedbackId: 'a', entryId: 'a' })).toEqual({
      threadId: 'a',
      entryId: 'a',
      isEntryShown: true,
    });
  });

  it.each([
    ['removed', 'gone'],
    ['gone', 'missing'],
  ])('falls back to the thread for a reply that is %s', (_case, entryId) => {
    expect(reviewFocusTarget(threads, { feedbackId: 'b', entryId })).toEqual({
      threadId: 'b',
      entryId: 'b',
      isEntryShown: false,
    });
  });

  it('finds nothing when the thread is not shown', () => {
    expect(reviewFocusTarget(threads, { feedbackId: 'z', entryId: 'z' })).toBeNull();
  });
});
