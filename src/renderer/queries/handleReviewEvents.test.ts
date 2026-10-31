import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEvent } from '@/shared/game-reviews-types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { moderationKeyCovers } from '../utils/moderationKeyCovers';
import { findEntry, type ReviewPages, updateEntry } from '../utils/reviewCache';
import { reviewEvent } from '../utils/reviewEvent.fixture';
import { reviewModerationKey } from '../utils/reviewModerationKey';
import { reviewPages, reviewReply, reviewThread } from '../utils/reviewPages.fixture';
import { reviewRefusalMessage } from '../utils/reviewRefusalMessage';
import { REVIEWS_KEY } from './reviewActions.fixture';

const store = vi.hoisted(() => ({
  seen: [] as string[],
  addNotification: vi.fn(),
  addReplyNotification: vi.fn<(reply: ReviewEvent, live: boolean) => boolean>(),
  showToast: vi.fn(),
}));
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: {
    getState: () => ({
      addNotification: store.addNotification,
      addReplyNotification: store.addReplyNotification,
      showToast: store.showToast,
      claimModerationEvent: (event: ReviewEvent) => {
        if (store.seen.some((key) => moderationKeyCovers(key, event))) {
          return false;
        }
        store.seen.push(reviewModerationKey(event));
        return true;
      },
    }),
  },
}));

const { handleReviewEvents } = await import('./handleReviewEvents');
const { refuseReviewWrite } = await import('./refuseReviewWrite');

let queryClient: QueryClient;
const cached = () => queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
const entry = (id: string) => findEntry(cached(), id)?.entry;
const overlay = () => useReviewOverlayStore.getState();
const handle = (event: ReviewEvent, live = true) =>
  handleReviewEvents(queryClient, [event], live);
const notices = () => store.addNotification.mock.calls.map(([notice]) => notice.type);
const setPending = (text: string) =>
  queryClient.setQueryData<ReviewPages>(
    REVIEWS_KEY,
    (data) =>
      data && updateEntry(data, 'held', (held) => ({ ...held, pendingText: text }))
  );

const removed = reviewEvent({ outcome: 'removed', at: '2026-10-22T10:06:00Z' });
const editRejected = reviewEvent({ editRejected: true, message: 'held' });
const publishedEdit = reviewEvent({ message: 'changed' });

beforeEach(() => {
  queryClient = new QueryClient();
  useReviewOverlayStore.setState({
    games: new Map(),
    rolledBack: new Map(),
    posting: new Set(),
    shown: new Map(),
  });
  store.seen = [];
  store.addNotification.mockReset();
  store.addReplyNotification.mockReset().mockReturnValue(true);
  store.showToast.mockReset();
  queryClient.setQueryData<ReviewPages>(
    REVIEWS_KEY,
    reviewPages([reviewThread('t', [{ ...reviewReply('held'), pendingText: 'changed' }])])
  );
});

describe('handleReviewEvents replies', () => {
  it('notifies every reply and refetches each game once per batch', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const first = reviewEvent({ kind: 'reply', entryId: 'r1', message: 'hi' });
    const second = reviewEvent({ kind: 'reply', entryId: 'r2', message: 'again' });

    handleReviewEvents(queryClient, [first, second], false);

    expect(store.addReplyNotification.mock.calls).toEqual([
      [first, false],
      [second, false],
    ]);
    expect(invalidate.mock.calls).toEqual([[{ queryKey: REVIEWS_KEY }]]);
  });

  it('refetches nothing for a reply shown before', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    store.addReplyNotification.mockReturnValue(false);

    handle(reviewEvent({ kind: 'reply', entryId: 'r1', message: 'hi' }), false);

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refreshes a game once for a batch of verdicts and replies on it', () => {
    void queryClient.prefetchQuery({
      queryKey: REVIEWS_KEY,
      queryFn: () => new Promise<ReviewPages>(() => undefined),
      staleTime: 0,
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    handleReviewEvents(
      queryClient,
      [
        editRejected,
        removed,
        reviewEvent({ entryId: 'gone', at: '2026-10-22T10:07:00Z' }),
        reviewEvent({ kind: 'reply', entryId: 'r1', message: 'hi' }),
      ],
      false
    );

    expect(invalidate.mock.calls).toEqual([[{ queryKey: REVIEWS_KEY }]]);
  });
});

describe('handleReviewEvents moderation', () => {
  it('publishes an edit that waited for moderation and says so in the list', () => {
    handle(publishedEdit, false);

    expect(entry('held')).toMatchObject({ text: 'changed', pendingText: null });
    expect(store.addNotification).toHaveBeenCalledWith(
      {
        type: 'review-published',
        gameId: 'g1',
        gameName: 'Game',
        feedbackId: 't',
        entryId: 'held',
        idPrefix: `review-${reviewModerationKey(publishedEdit)}`,
      },
      false
    );
  });

  it('only sets the badge of an entry that was not waiting', () => {
    const before = cached();

    handle(reviewEvent({ entryId: 't', message: 't' }));

    expect(cached()).toBe(before);
    expect(store.addNotification).not.toHaveBeenCalled();
  });

  it('fetches and announces an entry a moderator restored after its removal', () => {
    handle(removed);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    handle(reviewEvent({ message: 'held', at: '2026-10-22T10:07:00Z' }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(notices()).toEqual(['review-rejected', 'review-published']);
  });

  it('fetches a published root the pages on their way do not hold', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    handle(reviewEvent({ entryId: 'post', feedbackId: 'post', message: 'hello' }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(notices()).toEqual(['review-published']);
  });

  it('announces a rejected edit that a moderator published after all', () => {
    handle(editRejected);

    handle(reviewEvent({ message: 'changed', at: '2026-10-22T10:07:00Z' }));

    expect(entry('held')).toMatchObject({ text: 'changed', pendingText: null });
    expect(notices()).toEqual(['review-rejected', 'review-published']);
  });

  it('lets no catch-up verdict older than a live one undo it', () => {
    handle(reviewEvent({ message: 'changed', at: '2026-10-22T10:07:00Z' }));

    handle(removed, false);

    expect(entry('held')).toMatchObject({ text: 'changed' });
    expect(notices()).toEqual(['review-published']);
  });

  it('notifies about an entry the cache does not hold', () => {
    queryClient.clear();

    handle(publishedEdit);

    expect(store.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review-published', entryId: 'held' }),
      true
    );
  });

  it('removes a taken-down entry and keeps the notice in the list', () => {
    handle(removed);

    expect(entry('held')).toBeUndefined();
    expect(store.addNotification).toHaveBeenCalledWith(
      {
        type: 'review-rejected',
        gameId: 'g1',
        gameName: 'Game',
        feedbackId: 't',
        entryId: 'held',
        message: reviewRefusalMessage('removed'),
        idPrefix: `review-${reviewModerationKey(removed)}`,
      },
      true
    );
    expect(store.showToast).not.toHaveBeenCalled();
  });

  it('rolls back a rejected edit and keeps the notice in the list', () => {
    handle(editRejected, false);

    expect(entry('held')).toMatchObject({ text: 'held', pendingText: null });
    expect(overlay().rolledBack.get('g1')?.has('held')).toBe(true);
    expect(store.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'review-rejected',
        message: reviewRefusalMessage('edit_rejected'),
      }),
      false
    );
  });

  it('gives two verdicts on one entry their own notice ids', () => {
    handleReviewEvents(queryClient, [editRejected, removed], false);

    const [first, second] = store.addNotification.mock.calls.map(([n]) => n.idPrefix);
    expect(first).not.toBe(second);
  });

  it('handles a repeated verdict once', () => {
    handle(editRejected);
    setPending('again');
    handle({ ...editRejected, at: '2026-10-22T12:05:00.123456+02:00' });

    expect(entry('held')?.pendingText).toBe('again');
    expect(store.addNotification).toHaveBeenCalledTimes(1);
  });

  it('stays quiet about a verdict the write answer already showed', () => {
    overlay().markShown('held', 'removed');
    const before = cached();

    handle(removed);

    expect(cached()).toBe(before);
    expect(store.addNotification).not.toHaveBeenCalled();
    expect(overlay().shown.has('held')).toBe(false);
  });

  it('announces a second removal after a moderator restored the entry', () => {
    overlay().markShown('held', 'removed');
    refuseReviewWrite(queryClient, {
      gameId: 'g1',
      gameName: 'Game',
      entryId: 'held',
      effect: 'gone',
      reason: 'removed',
    });
    handle(removed);
    handle(reviewEvent({ message: 'held', at: '2026-10-22T10:07:00Z' }));
    handle({ ...removed, at: '2026-10-22T10:08:00Z' });

    expect(notices()).toEqual(['review-published', 'review-rejected']);
  });

  it('announces a rejection after another write was refused without being stored', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'more' });
    refuseReviewWrite(queryClient, {
      gameId: 'g1',
      gameName: 'Game',
      entryId: 'held',
      attempt,
      effect: 'refused',
      reason: 'edit_limit_reached',
    });

    handle(editRejected);

    expect(notices()).toEqual(['review-rejected']);
  });

  it('keeps a newer edit that failed to send when the earlier one is rejected', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    overlay().fail('g1', 'held', attempt, { code: 'rate_limit', kind: 'retry' }, vi.fn());

    handle(editRejected);

    expect(overlay().writeOf('g1', 'held')).toMatchObject({ state: 'failed', attempt });
    expect(entry('held')?.pendingText).toBeNull();
    expect(notices()).toEqual(['review-rejected']);
  });

  it('drops a write that failed to send when its entry is removed', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    overlay().fail('g1', 'held', attempt, { code: 'rate_limit', kind: 'retry' }, vi.fn());

    handle(removed);

    expect(overlay().writeOf('g1', 'held')).toBeUndefined();
  });

  it('fetches again when a page already on its way would undo the patch', () => {
    void queryClient.prefetchQuery({
      queryKey: REVIEWS_KEY,
      queryFn: () => new Promise<ReviewPages>(() => undefined),
      staleTime: 0,
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    handle(removed);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
  });
});

describe('handleReviewEvents against a write still checking', () => {
  it('neither drops nor overwrites the newer write', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    const before = cached();

    handle(removed);
    handle(editRejected);
    handle(publishedEdit);

    expect(cached()).toBe(before);
    expect(overlay().writeOf('g1', 'held')).toMatchObject({ state: 'checking', attempt });
    expect(store.addNotification).not.toHaveBeenCalled();
    // The held events wait on the store, so they run here rather than in the next test
    overlay().drop('g1', 'held');
  });

  it('applies a removal once the write fails, which its answer cannot undo', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    handle(removed);

    overlay().fail(
      'g1',
      'held',
      attempt,
      { code: 'unreachable', kind: 'retry' },
      vi.fn()
    );

    expect(entry('held')).toBeUndefined();
    expect(overlay().writeOf('g1', 'held')).toBeUndefined();
    expect(store.addNotification).toHaveBeenCalledTimes(1);
  });

  it('adds no second notice after the answer refused the same write', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    handle(removed);

    overlay().markShown('held', 'removed');
    refuseReviewWrite(queryClient, {
      gameId: 'g1',
      gameName: 'Game',
      entryId: 'held',
      attempt,
      effect: 'gone',
      reason: 'removed',
    });

    expect(store.showToast).toHaveBeenCalledTimes(1);
    expect(store.addNotification).not.toHaveBeenCalled();
  });

  it('refetches rather than strip the newer edit an older rejection waited on', () => {
    const attempt = overlay().start('g1', 'held', { kind: 'edit', text: 'newer' });
    handle(editRejected);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    overlay().markShown('held', 'pending');
    setPending('newer');
    overlay().drop('g1', 'held', attempt);

    expect(entry('held')?.pendingText).toBe('newer');
    expect(overlay().rolledBack.get('g1')).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(notices()).toEqual(['review-rejected']);
  });

  it('tells about a publish only when the answer left the entry waiting', () => {
    const answered = overlay().start('g1', 'held', { kind: 'edit', text: 'changed' });
    handle(publishedEdit);
    overlay().markShown('held', 'published');
    queryClient.setQueryData<ReviewPages>(
      REVIEWS_KEY,
      (data) =>
        data &&
        updateEntry(data, 'held', (held) => ({
          ...held,
          moderation: 'published',
          pendingText: null,
          text: 'changed',
        }))
    );
    overlay().drop('g1', 'held', answered);

    expect(store.addNotification).not.toHaveBeenCalled();

    const waiting = overlay().start('g1', 'held', { kind: 'edit', text: 'later' });
    handle(reviewEvent({ message: 'later', at: '2026-10-22T10:07:00Z' }));
    overlay().markShown('held', 'pending');
    setPending('later');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    overlay().drop('g1', 'held', waiting);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(store.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review-published' }),
      true
    );
  });
});

describe('handleReviewEvents on a root post the feedback form is sending', () => {
  const post = reviewEvent({ entryId: 'post', feedbackId: 'post', message: 'hello' });

  it('stays quiet about the verdict the form already shows', () => {
    overlay().startPost('post');

    handle(post);
    expect(store.addNotification).not.toHaveBeenCalled();

    overlay().endPost('post', 'published');

    expect(store.addNotification).not.toHaveBeenCalled();
  });

  it('announces a publish that came after the form said the post waits', () => {
    overlay().startPost('post');
    handle(post);

    overlay().endPost('post', 'pending');

    expect(notices()).toEqual(['review-published']);
  });
});
