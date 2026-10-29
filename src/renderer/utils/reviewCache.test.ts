import { describe, expect, it } from 'vitest';
import {
  appendReply,
  findEntry,
  findThread,
  nextReplyTime,
  type ReviewPages,
  updateEntry,
  withViewer,
} from './reviewCache';
import {
  removedReply,
  reviewAt,
  reviewPages,
  reviewReply,
  reviewThread,
} from './reviewPages.fixture';

const ids = (data: ReviewPages) =>
  data.pages.map((page) =>
    page.items.map((item) => [item.id, item.replies.map((entry) => entry.id)])
  );

describe('findEntry', () => {
  const data = reviewPages(
    [reviewThread('a')],
    [reviewThread('b', [reviewReply('r'), removedReply('gone')])]
  );

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
  const data = reviewPages([
    reviewThread('a', [reviewReply('r'), removedReply('gone')]),
    reviewThread('b'),
  ]);

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
    const data = reviewPages([reviewThread('a', [reviewReply('r')]), reviewThread('b')]);

    expect(ids(appendReply(data, 'a', reviewReply('new')))).toEqual([
      [
        ['a', ['r', 'new']],
        ['b', []],
      ],
    ]);
  });

  it('keeps the copy a refetch already brought', () => {
    const data = reviewPages([reviewThread('a', [reviewReply('r')])]);
    const next = appendReply(data, 'a', { ...reviewReply('r'), text: 'mine' });

    expect(ids(next)).toEqual([[['a', ['r']]]]);
    expect(findEntry(next, 'r')?.entry.text).toBe('r');
  });
});

describe('findThread', () => {
  it('finds a thread on any page', () => {
    expect(
      findThread(reviewPages([reviewThread('a')], [reviewThread('b')]), 'b')?.id
    ).toBe('b');
  });
});

describe('nextReplyTime', () => {
  it('uses the clock when it is ahead of the thread', () => {
    expect(
      nextReplyTime(reviewThread('a', [reviewReply('r', 5)]), Date.parse(reviewAt(30)))
    ).toBe(reviewAt(30));
  });

  it('dates a reply after the newest entry when the clock is behind', () => {
    expect(
      nextReplyTime(
        reviewThread('a', [reviewReply('r', 5), removedReply('gone')]),
        Date.parse(reviewAt(0))
      )
    ).toBe(new Date(Date.parse(reviewAt(5)) + 1).toISOString());
  });
});

describe('withViewer', () => {
  it('names the viewer on every page', () => {
    const viewer = { name: 'Quiet Owl', avatarSeed: '0a1b2c3d4e5f' };
    const data = withViewer(
      reviewPages([reviewThread('a')], [reviewThread('b')]),
      viewer
    );

    expect(data.pages.map((page) => page.viewer)).toEqual([viewer, viewer]);
  });
});
