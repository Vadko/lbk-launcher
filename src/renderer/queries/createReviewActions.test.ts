import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEditInput, ReviewReplyInput } from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { reviewReply } from '../utils/reviewPages.fixture';
import { reviewWritesKey } from './gameReviewsQueryKey';
import {
  deferAnswer,
  flush,
  OWL,
  published,
  REVIEWS_KEY,
  rateLimit,
  seedReviews,
  shownEntry,
  shownThread,
  unreachable,
  type WriteAnswer,
} from './reviewActions.fixture';
import type { ReviewThreadView } from './reviewViewTypes';

const mocks = vi.hoisted(() => ({
  sendReviewReply: vi.fn<(input: ReviewReplyInput) => Promise<WriteAnswer>>(),
  sendReviewEdit: vi.fn<(input: ReviewEditInput) => Promise<WriteAnswer>>(),
  ensureAuthor: vi.fn<() => Promise<ReviewAuthorIdentity | null>>(),
}));
vi.mock('./reviewsClient', () => ({
  sendReviewReply: mocks.sendReviewReply,
  sendReviewEdit: mocks.sendReviewEdit,
}));
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: { getState: () => ({ showToast: vi.fn() }) },
}));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: {
    getState: () => ({
      ensureAuthor: mocks.ensureAuthor,
      forgetAuthor: vi.fn(),
    }),
  },
}));

const { createReviewActions } = await import('./createReviewActions');
const { reviewWriteOptions } = await import('./reviewWrite');

let queryClient: QueryClient;
let thread: ReviewThreadView;

function seed(isPublic: boolean, viewer: ReviewAuthorIdentity | null = null) {
  thread = seedReviews(queryClient, isPublic);
  const observer = new MutationObserver(
    queryClient,
    reviewWriteOptions(queryClient, 'g1', 'Game')
  );
  return createReviewActions(
    queryClient,
    'g1',
    (write) => void observer.mutate(write).catch(() => undefined),
    viewer
  );
}

const sentIds = () => mocks.sendReviewReply.mock.calls.map(([input]) => input.id);
const writesInCache = () =>
  queryClient.getMutationCache().findAll({ mutationKey: reviewWritesKey('g1') }).length;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  mocks.sendReviewReply.mockImplementation(({ id }) => Promise.resolve(published(id)));
  mocks.sendReviewEdit.mockImplementation(({ id }) => Promise.resolve(published(id)));
});

describe('createReviewActions replies', () => {
  it('sends a private reply without asking for a nickname and shows it checking', async () => {
    const answer = deferAnswer(mocks.sendReviewReply);

    await expect(seed(false).sendReply(thread, 'hi', null)).resolves.toBe(true);
    await flush();
    const id = sentIds()[0];

    expect(mocks.ensureAuthor).not.toHaveBeenCalled();
    expect(mocks.sendReviewReply).toHaveBeenCalledWith(
      expect.objectContaining({ id, reviewId: 't', text: 'hi', isPublic: false })
    );
    expect(shownEntry(queryClient, id)).toMatchObject({ text: 'hi', isChecking: true });
    answer(published(id));
    await flush();
    expect(shownEntry(queryClient, id)).toMatchObject({ moderation: 'published' });
  });

  it('signs a public reply with the nickname the pages carry', async () => {
    await seed(true, OWL).sendReply(thread, 'hi', null);
    await flush();

    expect(mocks.ensureAuthor).not.toHaveBeenCalled();
    expect(shownEntry(queryClient, sentIds()[0])?.author).toMatchObject({
      name: OWL.name,
      isMine: true,
    });
  });

  it('asks for a nickname before a public reply and signs it with the picked one', async () => {
    mocks.ensureAuthor.mockResolvedValue(OWL);

    await expect(seed(true).sendReply(thread, 'hi', 'mine')).resolves.toBe(true);
    await flush();

    expect(mocks.sendReviewReply).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'mine', isPublic: true })
    );
    expect(shownEntry(queryClient, sentIds()[0])?.author).toMatchObject({
      name: OWL.name,
      avatarSeed: OWL.avatarSeed,
    });
  });

  it('sends nothing and keeps the composer open when the picker is closed', async () => {
    mocks.ensureAuthor.mockResolvedValue(null);

    await expect(seed(true).sendReply(thread, 'hi', null)).resolves.toBe(false);

    expect(mocks.sendReviewReply).not.toHaveBeenCalled();
    expect(writesInCache()).toBe(0);
  });

  it('dates a reply after the ones the thread view still holds', async () => {
    const actions = seed(false);
    const held = {
      ...reviewReply('held'),
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    };

    await actions.sendReply(
      { ...thread, replies: [...thread.replies, held] },
      'hi',
      null
    );

    const [{ id }] = mocks.sendReviewReply.mock.calls[0];
    await flush();
    expect(Date.parse(shownEntry(queryClient, id)?.createdAt ?? '')).toBeGreaterThan(
      Date.parse(held.createdAt)
    );
  });
});

describe('createReviewActions resend and discard', () => {
  it('resends a failed reply under the same id, keeping one write for it', async () => {
    mocks.sendReviewReply.mockResolvedValueOnce(rateLimit);
    const actions = seed(false);

    await actions.sendReply(thread, 'hi', null);
    await flush();
    const id = sentIds()[0];
    expect(shownEntry(queryClient, id)).toMatchObject({
      failure: { code: 'rate_limit' },
    });

    actions.resend(id);
    await flush();

    expect(sentIds()).toEqual([id, id]);
    expect(writesInCache()).toBe(1);
    expect(shownEntry(queryClient, id)).toMatchObject({ moderation: 'published' });
  });

  it.each([
    ['refetches after an unknown outcome', unreachable, 1],
    ['refetches nothing after a known refusal', rateLimit, 0],
  ])('%s once the write is discarded', async (_label, answer, refetches) => {
    mocks.sendReviewReply.mockResolvedValue(answer);
    const actions = seed(false);
    await actions.sendReply(thread, 'hi', null);
    await flush();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    actions.discard(sentIds()[0]);
    await flush();

    expect(writesInCache()).toBe(0);
    expect(shownEntry(queryClient, sentIds()[0])).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(refetches);
  });
});

describe('createReviewActions edits', () => {
  it('shows an edit checking and sends it with the thread visibility', async () => {
    const answer = deferAnswer(mocks.sendReviewEdit);

    seed(true).edit(thread, 'mine', 'changed');
    await flush();

    expect(mocks.sendReviewEdit).toHaveBeenCalledWith({
      id: 'mine',
      text: 'changed',
      isPublic: true,
    });
    expect(shownEntry(queryClient, 'mine')).toMatchObject({
      pendingText: 'changed',
      isChecking: true,
      write: 'edit',
    });
    answer(published('mine'));
    await flush();
    expect(shownThread(queryClient, 'mine')?.replies[0]).toMatchObject({
      text: 'changed',
      pendingText: null,
    });
  });

  it('forgets the answered edit when the entry is edited again', async () => {
    const actions = seed(true);

    actions.edit(thread, 'mine', 'first');
    await flush();
    actions.edit(thread, 'mine', 'second');
    await flush();

    expect(writesInCache()).toBe(1);
    expect(shownEntry(queryClient, 'mine')).toMatchObject({ text: 'second' });
  });
});

describe('createReviewActions answers', () => {
  it('keeps the answered reply shown while the refetch it asks for is out', async () => {
    const actions = seed(false);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await actions.sendReply(thread, 'hi', null);
    await flush();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(shownEntry(queryClient, sentIds()[0])).toMatchObject({
      moderation: 'published',
    });
  });
});
