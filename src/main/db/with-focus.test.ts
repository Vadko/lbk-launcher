import { describe, expect, it } from 'vitest';
import type { GameReview } from '../../shared/game-reviews-types';
import { withFocus } from './with-focus';

const thread = (id: string, text = `text ${id}`): GameReview => ({
  id,
  text,
  createdAt: '2026-10-22T10:00:00.123456+00:00',
  editedAt: null,
  author: { role: 'player', name: 'Quiet Owl', avatarSeed: 'seed', isMine: false },
  moderation: 'published',
  pendingText: null,
  type: 'feedback',
  isPublic: true,
  screenshots: [],
  replies: [],
});

const page = (items: GameReview[], focus: GameReview | null) => ({
  items,
  total: 12,
  nextCursor: 'c|b',
  viewer: null,
  focus,
});

describe('withFocus', () => {
  it('puts a focus thread from a later page first', () => {
    expect(withFocus(page([thread('a'), thread('b')], thread('z')))).toEqual({
      items: [thread('z'), thread('a'), thread('b')],
      total: 12,
      nextCursor: 'c|b',
      viewer: null,
    });
  });

  it('keeps the page as it is when the focus thread is already on it', () => {
    const items = [thread('a'), thread('b')];

    expect(withFocus(page(items, thread('b', 'focus copy'))).items).toBe(items);
  });

  it('leaves the page alone without a focus', () => {
    const items = [thread('a')];

    expect(withFocus(page(items, null))).toEqual({
      items,
      total: 12,
      nextCursor: 'c|b',
      viewer: null,
    });
  });
});
