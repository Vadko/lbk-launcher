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
    reviewThread('a', [reviewReply('r'), { ...reviewReply('child'), parentId: 'r' }]),
    reviewThread('b'),
  ]);

  it('patches a reply and leaves the rest alone', () => {
    const next = updateEntry(data, 'r', (entry) => ({ ...entry, text: 'new' }));

    expect(findEntry(next, 'r')?.entry.text).toBe('new');
    expect(next.pages[0]?.items[1]).toBe(data.pages[0]?.items[1]);
  });

  it('hands back the same pages when no entry matches', () => {
    expect(updateEntry(data, 'nope', () => null)).toBe(data);
  });

  it('keeps the identity of the pages and threads it did not touch', () => {
    const paged = reviewPages(
      [reviewThread('a', [reviewReply('r')]), reviewThread('b')],
      [reviewThread('c')]
    );
    const next = updateEntry(paged, 'r', () => null);

    expect(next.pages[0]?.items[1]).toBe(paged.pages[0]?.items[1]);
    expect(next.pages[1]).toBe(paged.pages[1]);
  });
});

describe('updateEntry removal', () => {
  const child = (id: string, parentId: string) => ({ ...reviewReply(id), parentId });
  // r1 > r2 > r3, s1 (stub) > r4, r5, s2 (stub) > s3 (stub) > r6
  const data = reviewPages([
    reviewThread('a', [
      reviewReply('r1'),
      child('r2', 'r1'),
      child('r3', 'r2'),
      removedReply('s1'),
      child('r4', 's1'),
      reviewReply('r5'),
      removedReply('s2'),
      removedReply('s3', 's2'),
      child('r6', 's3'),
    ]),
    reviewThread('b'),
  ]);
  const shape = (pages: ReviewPages) =>
    pages.pages.map((page) =>
      page.items.map((thread) => [
        thread.id,
        thread.replies.map((reply) => ('removed' in reply ? `${reply.id}*` : reply.id)),
      ])
    );

  it.each([
    ['a root takes its whole thread', 'a', [[['b', []]]]],
    [
      'a reply with a visible reply under it becomes a stub',
      'r2',
      [
        [
          ['a', ['r1', 'r2*', 'r3', 's1*', 'r4', 'r5', 's2*', 's3*', 'r6']],
          ['b', []],
        ],
      ],
    ],
    [
      'a reply with a whole branch under it becomes a stub',
      'r1',
      [
        [
          ['a', ['r1*', 'r2', 'r3', 's1*', 'r4', 'r5', 's2*', 's3*', 'r6']],
          ['b', []],
        ],
      ],
    ],
    [
      'a reply without replies goes',
      'r5',
      [
        [
          ['a', ['r1', 'r2', 'r3', 's1*', 'r4', 's2*', 's3*', 'r6']],
          ['b', []],
        ],
      ],
    ],
    [
      'a stub left with nothing visible goes too',
      'r4',
      [
        [
          ['a', ['r1', 'r2', 'r3', 'r5', 's2*', 's3*', 'r6']],
          ['b', []],
        ],
      ],
    ],
    [
      'a chain of stubs goes up to the first that still holds a visible reply',
      'r6',
      [
        [
          ['a', ['r1', 'r2', 'r3', 's1*', 'r4', 'r5']],
          ['b', []],
        ],
      ],
    ],
    [
      'a stub is never touched',
      's1',
      [
        [
          ['a', ['r1', 'r2', 'r3', 's1*', 'r4', 'r5', 's2*', 's3*', 'r6']],
          ['b', []],
        ],
      ],
    ],
  ])('%s', (_label, entryId, expected) => {
    expect(shape(updateEntry(data, entryId, () => null))).toEqual(expected);
  });

  it('stops a chain of stubs at one that still holds another visible reply', () => {
    const forked = reviewPages([
      reviewThread('a', [
        removedReply('s2'),
        removedReply('s3', 's2'),
        child('r6', 's3'),
        child('r7', 's2'),
      ]),
    ]);

    expect(shape(updateEntry(forked, 'r6', () => null))).toEqual([
      [['a', ['s2*', 'r7']]],
    ]);
  });

  it('keeps the other thread as it was', () => {
    expect(updateEntry(data, 'r5', () => null).pages[0]?.items[1]).toBe(
      data.pages[0]?.items[1]
    );
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
