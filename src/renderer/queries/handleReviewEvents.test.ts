import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { ReviewEvent } from '@/shared/game-reviews-types';
import { reviewEvent } from '../utils/reviewEvent.fixture';
import { reviewModerationKey } from '../utils/reviewModerationKey';
import { reviewRefusalMessage } from '../utils/reviewRefusalMessage';
import { feedbackPostsKey } from './gameReviewsQueryKey';
import {
  deferAnswer,
  editRefused,
  flush,
  pendingAnswer,
  published,
  REVIEWS_KEY,
  rateLimit,
  type WriteAnswer,
} from './reviewActions.fixture';
import type { ReviewWrite } from './reviewWrite';

const mocks = vi.hoisted(() => ({
  seen: [] as string[],
  addNotification: vi.fn(),
  addReplyNotification: vi.fn<(reply: ReviewEvent, live: boolean) => boolean>(),
  sendReviewEdit: vi.fn<() => Promise<WriteAnswer>>(),
}));
vi.mock('./reviewsClient', () => ({ sendReviewEdit: mocks.sendReviewEdit }));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: { getState: () => ({}) },
}));
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: {
    getState: () => ({
      addNotification: mocks.addNotification,
      addReplyNotification: mocks.addReplyNotification,
      showToast: vi.fn(),
      claimModerationEvent: (event: ReviewEvent) => {
        const key = reviewModerationKey(event);
        if (mocks.seen.includes(key)) {
          return false;
        }
        mocks.seen.push(key);
        return true;
      },
    }),
  },
}));

const { handleReviewEvents } = await import('./handleReviewEvents');
const { reviewWriteOptions } = await import('./reviewWrite');

let queryClient: QueryClient;
let invalidate: MockInstance<QueryClient['invalidateQueries']>;

const handle = (event: ReviewEvent, live = true) =>
  handleReviewEvents(queryClient, [event], live);
const notices = () => mocks.addNotification.mock.calls.map(([notice]) => notice);
// The refresh cancels a first load before it invalidates, so the invalidate lands a tick later
const refetched = async () => {
  await flush();
  return invalidate.mock.calls.map(([filters]) => filters?.queryKey);
};

const editOf = (entryId: string): ReviewWrite => ({
  kind: 'edit',
  entryId,
  reviewId: 't',
  isPublic: true,
  text: 'changed',
});

// The viewer's own edit of the entry, answered by the mock or left checking
async function write(answer?: WriteAnswer) {
  const settle = deferAnswer(mocks.sendReviewEdit);
  const observer = new MutationObserver(
    queryClient,
    reviewWriteOptions(queryClient, 'g1', 'Game')
  );
  void observer.mutate(editOf('held')).catch(() => undefined);
  if (answer) {
    settle(answer);
    await flush();
  }
  invalidate.mockClear();
  return settle;
}

function post(outcome?: 'published' | 'pending') {
  const observer = new MutationObserver(queryClient, {
    mutationKey: feedbackPostsKey,
    mutationFn: (_: { entryId: string }) =>
      outcome
        ? Promise.resolve({ ok: true, outcome })
        : new Promise<never>(() => undefined),
  });
  void observer.mutate({ entryId: 'held' });
  return flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  mocks.seen = [];
  mocks.addReplyNotification.mockReturnValue(true);
});

describe('handleReviewEvents replies', () => {
  it('notifies every reply and refetches each game once per batch', async () => {
    handleReviewEvents(
      queryClient,
      [
        reviewEvent({ kind: 'reply', entryId: 'r1' }),
        reviewEvent({ kind: 'reply', entryId: 'r2' }),
        reviewEvent({ kind: 'reply', entryId: 'r3', gameId: 'g2' }),
      ],
      false
    );

    expect(mocks.addReplyNotification).toHaveBeenCalledTimes(3);
    expect(mocks.addReplyNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ entryId: 'r3' }),
      false
    );
    expect(await refetched()).toEqual([REVIEWS_KEY, ['game-reviews', 'g2']]);
  });

  it('refetches nothing for a reply shown before', async () => {
    mocks.addReplyNotification.mockReturnValue(false);

    handle(reviewEvent({ kind: 'reply' }));

    expect(await refetched()).toEqual([]);
  });
});

describe('handleReviewEvents moderation', () => {
  it('announces a publish in the list and refetches the game', async () => {
    handle(reviewEvent());

    expect(notices()).toEqual([
      {
        type: 'review-published',
        gameId: 'g1',
        gameName: 'Game',
        feedbackId: 't',
        entryId: 'held',
        idPrefix: `review-${reviewModerationKey(reviewEvent())}`,
      },
    ]);
    expect(mocks.addNotification).toHaveBeenCalledWith(expect.anything(), true);
    expect(await refetched()).toEqual([REVIEWS_KEY]);
  });

  it.each([
    ['a removal', reviewEvent({ outcome: 'removed' }), 'removed'],
    ['a rejected edit', reviewEvent({ editRejected: true }), 'edit_rejected'],
  ] as const)('keeps a notice of %s in the list', (_label, event, reason) => {
    handle(event, false);

    expect(notices()).toEqual([
      expect.objectContaining({
        type: 'review-rejected',
        entryId: 'held',
        message: reviewRefusalMessage(reason),
      }),
    ]);
    expect(mocks.addNotification).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('announces nothing for an edit moderation still holds', () => {
    handle(reviewEvent({ outcome: 'pending' }));

    expect(notices()).toEqual([]);
  });

  it('handles a repeated verdict once', async () => {
    handle(reviewEvent());
    handle(reviewEvent());

    expect(notices()).toHaveLength(1);
    expect(await refetched()).toHaveLength(1);
  });

  it('gives two verdicts on one entry their own notice ids', () => {
    handleReviewEvents(
      queryClient,
      [reviewEvent({ outcome: 'removed' }), reviewEvent({ at: '2026-10-22T10:07:00Z' })],
      true
    );

    const ids = notices().map(({ idPrefix }) => idPrefix);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('handleReviewEvents against the viewer own write', () => {
  it('stays quiet while the answer is still coming', async () => {
    const answer = await write();

    handle(reviewEvent());

    expect(notices()).toEqual([]);
    expect(await refetched()).toEqual([]);
    answer(published('held'));
  });

  it.each([
    ['a publish', published('held'), reviewEvent()],
    ['a rejected edit', editRefused('held'), reviewEvent({ editRejected: true })],
  ])('stays quiet about %s the answer already showed', async (_label, answer, event) => {
    await write(answer);

    handle(event);

    expect(notices()).toEqual([]);
  });

  it('announces a publish that came after the answer said the edit waits', async () => {
    await write(pendingAnswer('held'));

    handle(reviewEvent());

    expect(notices()).toEqual([expect.objectContaining({ type: 'review-published' })]);
    expect(await refetched()).toEqual([REVIEWS_KEY]);
  });

  it('announces a verdict on a write that failed to send', async () => {
    await write(rateLimit);

    handle(reviewEvent({ outcome: 'removed' }));

    expect(notices()).toEqual([expect.objectContaining({ type: 'review-rejected' })]);
  });
});

describe('handleReviewEvents on a root post the feedback form sent', () => {
  it('stays quiet while the form waits for its answer', async () => {
    await post();

    handle(reviewEvent());

    expect(notices()).toEqual([]);
  });

  it('stays quiet about the verdict the form shows', async () => {
    await post('published');

    handle(reviewEvent());

    expect(notices()).toEqual([]);
  });

  it('announces a publish that came after the form said the post waits', async () => {
    await post('pending');

    handle(reviewEvent());

    expect(notices()).toEqual([expect.objectContaining({ type: 'review-published' })]);
  });
});
