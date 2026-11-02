import { describe, expect, it } from 'vitest';
import type { GameReviewReply } from '@/shared/game-reviews-types';
import { branchesToReveal } from './branchesToReveal';
import { buildReplyTree } from './replyTree';

let clock = 0;

const reply = (id: string, parentId: string | null): GameReviewReply => ({
  id,
  parentId,
  text: id,
  createdAt: new Date(Date.UTC(2026, 9, 22) + ++clock * 60_000).toISOString(),
  editedAt: null,
  author: { role: 'player', name: `name-${id}`, avatarSeed: `seed-${id}`, isMine: false },
  moderation: 'published',
  pendingText: null,
});

// Five answers to the review, the fourth with five answers of its own and one deeper
const tree = buildReplyTree(
  'review',
  [
    reply('a', null),
    reply('b', null),
    reply('c', null),
    reply('d', null),
    reply('e', null),
    reply('d1', 'd'),
    reply('d2', 'd'),
    reply('d3', 'd'),
    reply('d4', 'd'),
    reply('d4a', 'd4'),
  ],
  3
);

describe('branchesToReveal', () => {
  it('opens nothing for an entry among the first replies of open branches', () => {
    expect(branchesToReveal(tree, 'b')).toEqual([]);
  });

  it('opens the branch whose hidden part holds the entry', () => {
    expect(branchesToReveal(tree, 'e')).toEqual(['review']);
  });

  it.each([
    ['a hidden reply of a hidden branch', 'd2', ['review']],
    ['a reply below two collapsed branches', 'd4a', ['review', 'd']],
  ])(
    'opens every collapsed branch above %s, outermost first',
    (_case, entryId, expected) => {
      expect(branchesToReveal(tree, entryId)).toEqual(expected);
    }
  );

  it.each([
    ['the review itself', 'review'],
    ['an unknown entry', 'missing'],
  ])('finds nothing for %s', (_case, entryId) => {
    expect(branchesToReveal(tree, entryId)).toBeNull();
  });
});
