import { describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { ReviewViewPages } from '../queries/reviewViewTypes';
import {
  applyOverlay,
  type GameReviewWrites,
  NO_REVIEW_WRITES,
  type ReviewWrite,
} from './reviewOverlay';
import {
  removedReply,
  reviewPages,
  reviewReply,
  reviewThread,
} from './reviewPages.fixture';

const FAILURE: ReviewFailure = { code: 'unreachable', kind: 'retry' };
const resend = () => Promise.resolve();

const replyWrite = (
  id: string,
  reviewId: string,
  failure: ReviewFailure | null = null
): ReviewWrite => ({
  kind: 'reply',
  reviewId,
  reply: { ...reviewReply(id, 30), moderation: 'pending' },
  attempt: 1,
  ...(failure ? { state: 'failed', failure, resend } : { state: 'checking' }),
});

const editWrite = (text: string, failure: ReviewFailure | null = null): ReviewWrite => ({
  kind: 'edit',
  text,
  attempt: 1,
  ...(failure ? { state: 'failed', failure, resend } : { state: 'checking' }),
});

const writes = (...entries: [string, ReviewWrite][]): GameReviewWrites =>
  new Map(entries);

const shape = (data: ReviewViewPages) =>
  data.pages.flatMap((page) =>
    page.items.flatMap((thread) => [thread, ...thread.replies])
  );

const view = (data: ReviewViewPages, id: string) =>
  shape(data).find((item) => item.id === id);

const base = () =>
  reviewPages(
    [reviewThread('a', [reviewReply('r1')]), reviewThread('b', [removedReply('gone')])],
    [reviewThread('c')]
  );

describe('applyOverlay', () => {
  it('hands the data back untouched without writes', () => {
    const data = base();

    expect(applyOverlay(data, NO_REVIEW_WRITES)).toBe(data);
  });

  it.each([
    [
      'appends a checking reply last in its thread',
      writes(['new', replyWrite('new', 'a')]),
      'new',
      { id: 'new', write: 'reply', isChecking: true, moderation: 'pending' },
    ],
    [
      'appends a failed reply with its failure',
      writes(['new', replyWrite('new', 'a', FAILURE)]),
      'new',
      { id: 'new', write: 'reply', isChecking: false, failure: FAILURE },
    ],
    [
      'only flags a reply a refetch already brought',
      writes(['r1', replyWrite('r1', 'a', FAILURE)]),
      'r1',
      { id: 'r1', text: 'r1', moderation: 'published', failure: FAILURE },
    ],
    [
      'holds the edit of a published entry beside its text',
      writes(['r1', editWrite('changed')]),
      'r1',
      { id: 'r1', text: 'r1', pendingText: 'changed', write: 'edit', isChecking: true },
    ],
    [
      'shows a failed edit of a root',
      writes(['a', editWrite('changed', FAILURE)]),
      'a',
      { id: 'a', pendingText: 'changed', write: 'edit', failure: FAILURE },
    ],
  ] as const)('%s', (_label, overlay, id, expected) => {
    expect(view(applyOverlay(base(), overlay), id)).toMatchObject(expected);
  });

  it('never doubles a reply whose id is already in its thread', () => {
    const data = applyOverlay(base(), writes(['r1', replyWrite('r1', 'a')]));

    expect(data.pages[0]?.items[0]?.replies.map((reply) => reply.id)).toEqual(['r1']);
  });

  it.each([
    ['a reply to a thread that is not loaded', writes(['new', replyWrite('new', 'zzz')])],
    ['an edit of an entry that is not loaded', writes(['zzz', editWrite('changed')])],
    ['an edit of a removed stub', writes(['gone', editWrite('changed')])],
  ])('skips %s', (_label, overlay) => {
    const data = base();

    expect(applyOverlay(data, overlay)).toBe(data);
  });

  it('keeps the identity of every thread and page the writes do not touch', () => {
    const data = base();
    const next = applyOverlay(data, writes(['new', replyWrite('new', 'a')]));

    expect(next.pages[0]?.items[0]).not.toBe(data.pages[0]?.items[0]);
    expect(next.pages[0]?.items[1]).toBe(data.pages[0]?.items[1]);
    expect(next.pages[1]).toBe(data.pages[1]);
  });

  it('keeps the untouched replies of a touched thread', () => {
    const data = base();
    const next = applyOverlay(data, writes(['new', replyWrite('new', 'a')]));

    expect(next.pages[0]?.items[0]?.replies[0]).toBe(data.pages[0]?.items[0]?.replies[0]);
  });

  it('marks a rolled-back entry and leaves its thread neighbours as they were', () => {
    const data = base();
    const next = applyOverlay(data, NO_REVIEW_WRITES, new Set(['r1']));

    expect(view(next, 'r1')).toMatchObject({ id: 'r1', text: 'r1', isRolledBack: true });
    expect(view(next, 'a')).not.toHaveProperty('isRolledBack');
    expect(next.pages[1]).toBe(data.pages[1]);
  });
});
