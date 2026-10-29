import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type {
  ReviewFailure,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import type { ReviewPages } from '../utils/reviewCache';
import { applyOverlay, NO_REVIEW_WRITES } from '../utils/reviewOverlay';
import { reviewPages, reviewReply, reviewThread } from '../utils/reviewPages.fixture';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import type { ReviewReplyView, ReviewThreadView } from './reviewViewTypes';

export type WriteAnswer = ReviewResult<ReviewWriteResult>;

export const OWL: ReviewAuthorIdentity = {
  name: 'Quiet Owl',
  avatarSeed: '0a1b2c3d4e5f',
};
export const REVIEWS_KEY = gameReviewsQueryKey('g1');
const MINUTE = 60_000;
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
export const published = (id: string): WriteAnswer => ({
  ok: true,
  data: { id, outcome: 'published' },
});
const failed = (failure: ReviewFailure): WriteAnswer => ({ ok: false, failure });
export const needsAuthor = failed({ code: 'author_required', kind: 'needs-author' });
export const rateLimit = failed({ code: 'rate_limit', kind: 'retry' });
export const unreachable = failed({ code: 'unreachable', kind: 'retry' });
export const banned = failed({ code: 'banned', kind: 'rejected' });
export const liveSignal = () => new AbortController().signal;

// Resolves the next request whenever the test says so
export function deferAnswer<Input>(mock: Mock<(input: Input) => Promise<WriteAnswer>>) {
  let answer: (result: WriteAnswer) => void = () => undefined;
  mock.mockReturnValueOnce(
    new Promise((resolve) => {
      answer = resolve;
    })
  );
  return (result: WriteAnswer) => answer(result);
}

// One thread with the viewer's reply inside the edit window and one past it
export function seedReviews(
  queryClient: QueryClient,
  isPublic: boolean,
  viewer: ReviewAuthorIdentity | null
): void {
  const own = {
    ...reviewReply('mine'),
    createdAt: new Date(Date.now() - MINUTE).toISOString(),
    author: {
      role: 'player' as const,
      name: 'Quiet Owl',
      avatarSeed: 'seed',
      isMine: true,
    },
  };
  const old = {
    ...own,
    id: 'old',
    createdAt: new Date(Date.now() - 20 * MINUTE).toISOString(),
  };
  const data = reviewPages([reviewThread('t', [own, old], isPublic)]);
  queryClient.setQueryData<ReviewPages>(REVIEWS_KEY, {
    ...data,
    pages: data.pages.map((page) => ({ ...page, viewer })),
  });
}

export const heldWrites = () =>
  useReviewOverlayStore.getState().games.get('g1') ?? NO_REVIEW_WRITES;

export function shownEntry(queryClient: QueryClient, id: string) {
  const data = queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
  return data
    ? applyOverlay(data, heldWrites())
        .pages.flatMap((page) => page.items)
        .flatMap((thread) => [thread, ...thread.replies])
        .find(
          (item): item is ReviewThreadView | ReviewReplyView =>
            item.id === id && !('removed' in item)
        )
    : undefined;
}

export const isCached = (queryClient: QueryClient, id: string) =>
  queryClient
    .getQueryData<ReviewPages>(REVIEWS_KEY)
    ?.pages.some((page) =>
      page.items.some(
        (thread) => thread.id === id || thread.replies.some((reply) => reply.id === id)
      )
    );
