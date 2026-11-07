import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type {
  ReviewEditResult,
  ReviewFailure,
  ReviewResult,
  ReviewWriteResult,
} from '@/shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import type { ReviewPages } from '../utils/reviewCache';
import { reviewPages, reviewReply, reviewThread } from '../utils/reviewPages.fixture';
import { reviewWriteState, withReviewWrites } from '../utils/withReviewWrites';
import { findReviewWrite } from './entryWrites';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import type { ReviewReplyView, ReviewThreadView } from './reviewViewTypes';

export type WriteAnswer = ReviewResult<ReviewWriteResult | ReviewEditResult>;

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
export const pendingAnswer = (id: string): WriteAnswer => ({
  ok: true,
  data: { id, outcome: 'pending' },
});
export const removedAnswer = (id: string): WriteAnswer => ({
  ok: true,
  data: { id, outcome: 'removed' },
});
export const editRefused = (id: string): WriteAnswer => ({
  ok: true,
  data: { id, outcome: 'published', editRejected: true },
});
const failed = (failure: ReviewFailure): WriteAnswer => ({ ok: false, failure });
export const needsAuthor = failed({ code: 'author_required', kind: 'needs-author' });
export const rateLimit = failed({ code: 'rate_limit', kind: 'retry' });
export const unreachable = failed({ code: 'unreachable', kind: 'retry' });
export const banned = failed({ code: 'banned', kind: 'rejected' });
export const notFound = failed({ code: 'not_found', kind: 'rejected' });

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
  isPublic: boolean
): ReviewThreadView {
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
  const thread = reviewThread('t', [own, old], isPublic);
  queryClient.setQueryData<ReviewPages>(REVIEWS_KEY, reviewPages([thread]));
  return thread;
}

// The thread as the list shows it with the writes on the given entries
export function shownThread(
  queryClient: QueryClient,
  ...entryIds: string[]
): ReviewThreadView | undefined {
  const data = queryClient.getQueryData<ReviewPages>(REVIEWS_KEY);
  const states = entryIds.flatMap((id) => {
    const write = findReviewWrite(queryClient, 'g1', id);
    return write ? [reviewWriteState(write)] : [];
  });
  return data && withReviewWrites(data, states).pages[0]?.items[0];
}

export function shownEntry(queryClient: QueryClient, id: string) {
  const thread = shownThread(queryClient, id);
  return [thread, ...(thread?.replies ?? [])].find(
    (item): item is ReviewThreadView | ReviewReplyView =>
      item !== undefined && item.id === id && !('removed' in item)
  );
}
