import { describe, expect, it } from 'vitest';
import type {
  GameReview,
  GameReviewReply,
  GameReviewThreadReply,
} from '@/shared/game-reviews-types';
import {
  appendReply,
  findEntry,
  findThread,
  nextReplyTime,
  type ReviewPages,
  updateEntry,
} from './reviewCache';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 22, 10, minute)).toISOString();

const reply = (id: string, minute = 1): GameReviewReply => ({
  id,
  parentId: null,
  text: id,
  createdAt: at(minute),
  editedAt: null,
  author: { role: 'player', name: id, avatarSeed: id, isMine: false },
  moderation: 'published',
  pendingText: null,
});

const stub = (id: string): GameReviewThreadReply => ({
  id,
  parentId: null,
  createdAt: at(2),
  removed: true,
});

const thread = (id: string, replies: GameReviewThreadReply[] = []): GameReview => ({
  ...reply(id, 0),
  type: 'feedback',
  isPublic: true,
  screenshots: [],
  replies,
});

const pages = (...items: GameReview[][]): ReviewPages => ({
  pages: items.map((page) => ({ items: page, total: 9, nextCursor: null, viewer: null })),
  pageParams: items.map(() => null),
});

const ids = (data: ReviewPages) =>
  data.pages.map((page) =>
    page.items.map((item) => [item.id, item.replies.map((entry) => entry.id)])
  );

describe('findEntry', () => {
  const data = pages([thread('a')], [thread('b', [reply('r'), stub('gone')])]);

  it.each([
    ['a root', 'a', 'a', 'a'],
    ['a reply on a later page', 'r', 'b', 'r'],
  ])('finds %s with its thread', (_label, entryId, threadId, foundId) => {
    const found = findEntry(data, entryId);

    expect([found?.thread.id, found?.entry.id]).toEqual([threadId, foundId]);
  });

  it.each([
    ['a removed stub', 'gone'],
    ['an unknown id', 'nope'],
  ])('finds nothing for %s', (_label, entryId) => {
    expect(findEntry(data, entryId)).toBeNull();
  });

  it('finds nothing before the first page', () => {
    expect(findEntry(undefined, 'a')).toBeNull();
  });
});

describe('updateEntry', () => {
  const data = pages([thread('a', [reply('r'), stub('gone')]), thread('b')]);

  it('patches a reply and leaves the rest alone', () => {
    const next = updateEntry(data, 'r', (entry) => ({ ...entry, text: 'new' }));

    expect(findEntry(next, 'r')?.entry.text).toBe('new');
    expect(next.pages[0]?.items[1]).toEqual(data.pages[0]?.items[1]);
  });

  it('removes a reply', () => {
    expect(ids(updateEntry(data, 'r', () => null))).toEqual([
      [
        ['a', ['gone']],
        ['b', []],
      ],
    ]);
  });

  it('removes a root with its thread', () => {
    expect(ids(updateEntry(data, 'a', () => null))).toEqual([[['b', []]]]);
  });

  it('never touches a stub', () => {
    expect(ids(updateEntry(data, 'gone', () => null))).toEqual(ids(data));
  });
});

describe('appendReply', () => {
  it('adds the reply last in its thread only', () => {
    const data = pages([thread('a', [reply('r')]), thread('b')]);

    expect(ids(appendReply(data, 'a', reply('new')))).toEqual([
      [
        ['a', ['r', 'new']],
        ['b', []],
      ],
    ]);
  });
});

describe('findThread', () => {
  it('finds a thread on any page', () => {
    expect(findThread(pages([thread('a')], [thread('b')]), 'b')?.id).toBe('b');
  });
});

describe('nextReplyTime', () => {
  it('uses the clock when it is ahead of the thread', () => {
    expect(nextReplyTime(thread('a', [reply('r', 5)]), Date.parse(at(30)))).toBe(at(30));
  });

  it('dates a reply after the newest entry when the clock is behind', () => {
    expect(
      nextReplyTime(thread('a', [reply('r', 5), stub('gone')]), Date.parse(at(0)))
    ).toBe(new Date(Date.parse(at(5)) + 1).toISOString());
  });
});
