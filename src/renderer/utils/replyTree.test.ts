import { describe, expect, it } from 'vitest';
import type { GameReviewReply } from '@/shared/game-reviews-types';
import { buildReplyTree, countReplies, type ReplyNode } from './replyTree';

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

const shape = (nodes: ReplyNode[]): unknown[] =>
  nodes.map((item) => ({
    id: item.reply.id,
    branchId: item.branchId,
    replyTo: item.replyTo?.name ?? null,
    children: shape(item.children),
  }));

describe('buildReplyTree', () => {
  it('nests replies under the entries they answer', () => {
    const tree = buildReplyTree(
      'review',
      [reply('a', null), reply('b', 'a'), reply('c', null), reply('d', 'b')],
      3
    );

    expect(shape(tree)).toEqual([
      {
        id: 'a',
        branchId: 'review',
        replyTo: null,
        children: [
          {
            id: 'b',
            branchId: 'a',
            replyTo: null,
            children: [{ id: 'd', branchId: 'b', replyTo: null, children: [] }],
          },
        ],
      },
      { id: 'c', branchId: 'review', replyTo: null, children: [] },
    ]);
  });

  it('keeps answers below the last level beside their parent and names whom they answer', () => {
    const tree = buildReplyTree(
      'review',
      [reply('a', null), reply('b', 'a'), reply('c', 'b'), reply('d', 'c')],
      2
    );

    expect(shape(tree)).toEqual([
      {
        id: 'a',
        branchId: 'review',
        replyTo: null,
        children: [
          { id: 'b', branchId: 'a', replyTo: null, children: [] },
          { id: 'c', branchId: 'a', replyTo: 'name-b', children: [] },
          { id: 'd', branchId: 'a', replyTo: 'name-c', children: [] },
        ],
      },
    ]);
  });

  it('places a parent first whatever order the replies arrive in', () => {
    const replies = [reply('a', null), reply('b', 'a'), reply('c', 'b')];
    const tree = buildReplyTree('review', replies.toReversed(), 3);

    expect(tree[0]?.children[0]?.children[0]?.reply.id).toBe('c');
    expect(tree[0]?.children[0]?.children[0]?.depth).toBe(3);
  });

  it('keeps an answer under a parent that a skewed clock dated later', () => {
    const parent = reply('a', null);
    const answer = { ...reply('b', 'a'), createdAt: '2000-01-01T00:00:00.000Z' };
    const tree = buildReplyTree('review', [parent, answer], 3);

    expect(tree.map((item) => item.reply.id)).toEqual(['a']);
    expect(tree[0]?.children[0]?.reply.id).toBe('b');
  });

  it('moves a reply whose parent is gone to the first level', () => {
    const tree = buildReplyTree('review', [reply('a', null), reply('b', 'removed')], 3);

    expect(shape(tree).map((item) => (item as { id: string }).id)).toEqual(['a', 'b']);
  });

  it('keeps a removed reply as a stub over the answers under it', () => {
    const stub = {
      id: 'gone',
      parentId: 'a',
      createdAt: reply('x', null).createdAt,
      removed: true as const,
    };
    const tree = buildReplyTree(
      'review',
      [reply('a', null), stub, reply('c', 'gone')],
      2
    );

    expect(shape(tree)).toEqual([
      {
        id: 'a',
        branchId: 'review',
        replyTo: null,
        children: [
          { id: 'gone', branchId: 'a', replyTo: null, children: [] },
          { id: 'c', branchId: 'a', replyTo: null, children: [] },
        ],
      },
    ]);
  });

  it('counts every reply in the hidden branches', () => {
    const tree = buildReplyTree(
      'review',
      [reply('a', null), reply('b', 'a'), reply('c', 'b'), reply('d', null)],
      3
    );

    expect(countReplies(tree)).toBe(4);
  });
});
