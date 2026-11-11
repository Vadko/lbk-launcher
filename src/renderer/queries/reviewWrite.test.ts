import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEditInput, ReviewReplyInput } from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { reviewReply } from '../utils/reviewPages.fixture';
import {
  banned,
  editRefused,
  flush,
  needsAuthor,
  notFound,
  OWL,
  pendingAnswer,
  published,
  REVIEWS_KEY,
  rateLimit,
  removedAnswer,
  type WriteAnswer,
} from './reviewActions.fixture';
import type { ReviewWrite } from './reviewWrite';

const mocks = vi.hoisted(() => ({
  sendReviewReply: vi.fn<(input: ReviewReplyInput) => Promise<WriteAnswer>>(),
  sendReviewEdit: vi.fn<(input: ReviewEditInput) => Promise<WriteAnswer>>(),
  ensureAuthor: vi.fn<() => Promise<ReviewAuthorIdentity | null>>(),
  forgetAuthor: vi.fn(),
  showToast: vi.fn(),
}));
vi.mock('./reviewsClient', () => ({
  sendReviewReply: mocks.sendReviewReply,
  sendReviewEdit: mocks.sendReviewEdit,
}));
vi.mock('../store/useSubscriptionsStore', () => ({
  useSubscriptionsStore: { getState: () => ({ showToast: mocks.showToast }) },
}));
vi.mock('../store/useReviewAuthorStore', () => ({
  useReviewAuthorStore: {
    getState: () => ({
      ensureAuthor: mocks.ensureAuthor,
      forgetAuthor: mocks.forgetAuthor,
    }),
  },
}));

const { ReviewWriteError, reviewWriteOptions, writeReview } = await import(
  './reviewWrite'
);

const reply: ReviewWrite = {
  kind: 'reply',
  entryId: 'n',
  reviewId: 't',
  isPublic: true,
  reply: { ...reviewReply('n'), text: 'hi', parentId: 'p' },
};
const edit: ReviewWrite = {
  kind: 'edit',
  entryId: 'mine',
  reviewId: 't',
  isPublic: false,
  text: 'changed',
};
const sentReplies = () => mocks.sendReviewReply.mock.calls.map(([input]) => input);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendReviewReply.mockImplementation(({ id }) => Promise.resolve(published(id)));
  mocks.sendReviewEdit.mockImplementation(({ id }) => Promise.resolve(published(id)));
});

describe('writeReview', () => {
  it('sends a reply under its own id with the thread and the answered entry', async () => {
    await expect(writeReview(reply)).resolves.toMatchObject({
      verdict: 'published',
      refusal: null,
    });

    expect(sentReplies()).toEqual([
      { id: 'n', reviewId: 't', parentId: 'p', text: 'hi', isPublic: true },
    ]);
  });

  it('sends an edit with the thread visibility', async () => {
    await writeReview(edit);

    expect(mocks.sendReviewEdit).toHaveBeenCalledWith({
      id: 'mine',
      text: 'changed',
      isPublic: false,
    });
  });

  it.each([
    ['held for moderation', pendingAnswer('mine'), 'pending', null],
    ['removed', removedAnswer('mine'), 'removed', 'removed'],
    ['a rejected edit', editRefused('mine'), 'rolledBack', 'edit_rejected'],
  ] as const)('answers %s with its verdict', async (_label, answer, verdict, refusal) => {
    mocks.sendReviewEdit.mockResolvedValue(answer);

    await expect(writeReview(edit)).resolves.toMatchObject({ verdict, refusal });
  });

  it.each([
    ['a reply whose target is gone', reply, notFound, 'reply_target_gone'],
    ['an edit of an entry that is gone', edit, notFound, 'not_found'],
    ['a banned machine', reply, banned, 'banned'],
  ] as const)('answers %s as stored nothing', async (_label, write, answer, refusal) => {
    mocks.sendReviewReply.mockResolvedValue(answer);
    mocks.sendReviewEdit.mockResolvedValue(answer);

    await expect(writeReview(write)).resolves.toMatchObject({ verdict: null, refusal });
  });

  it('throws a failure a resend may get past', async () => {
    mocks.sendReviewReply.mockResolvedValue(rateLimit);

    await expect(writeReview(reply)).rejects.toEqual(
      new ReviewWriteError({ code: 'rate_limit', kind: 'retry' })
    );
  });

  it('resends the same id once the picker gives a nickname', async () => {
    mocks.sendReviewReply.mockResolvedValueOnce(needsAuthor);
    mocks.ensureAuthor.mockResolvedValue(OWL);

    await expect(writeReview(reply)).resolves.toMatchObject({ verdict: 'published' });

    expect(mocks.forgetAuthor).toHaveBeenCalledTimes(1);
    expect(sentReplies().map(({ id }) => id)).toEqual(['n', 'n']);
  });

  it('keeps the write failed when the picker is closed', async () => {
    mocks.sendReviewReply.mockResolvedValue(needsAuthor);
    mocks.ensureAuthor.mockResolvedValue(null);

    await expect(writeReview(reply)).rejects.toMatchObject({
      failure: { kind: 'needs-author' },
    });
    expect(sentReplies()).toHaveLength(1);
  });

  it('opens the picker once when the server still wants a nickname', async () => {
    mocks.sendReviewReply.mockResolvedValue(needsAuthor);
    mocks.ensureAuthor.mockResolvedValue(OWL);

    await expect(writeReview(reply)).rejects.toBeInstanceOf(ReviewWriteError);
    expect(mocks.ensureAuthor).toHaveBeenCalledTimes(1);
    expect(sentReplies()).toHaveLength(2);
  });
});

describe('reviewWriteOptions', () => {
  const run = async (write: ReviewWrite) => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const observer = new MutationObserver(
      queryClient,
      reviewWriteOptions(queryClient, 'g1', 'Game')
    );
    await observer.mutate(write).catch(() => undefined);
    await flush();
    return invalidate;
  };

  it('refetches the pages after an answer without a toast', async () => {
    const invalidate = await run(reply);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it('tells about a refusal, linked to the thread', async () => {
    mocks.sendReviewEdit.mockResolvedValue(editRefused('mine'));

    await run(edit);

    expect(mocks.showToast).toHaveBeenCalledWith({
      type: 'review-rejected',
      gameId: 'g1',
      gameName: 'Game',
      feedbackId: 't',
      entryId: 'mine',
      refusalReason: 'edit_rejected',
    });
  });

  it('neither tells nor refetches after a failed send', async () => {
    mocks.sendReviewReply.mockResolvedValue(rateLimit);

    const invalidate = await run(reply);

    expect(invalidate).not.toHaveBeenCalled();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});
