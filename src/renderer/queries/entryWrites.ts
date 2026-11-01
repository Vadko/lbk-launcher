import type { Mutation, QueryClient } from '@tanstack/react-query';
import { feedbackPostsKey, reviewWritesKey } from './gameReviewsQueryKey';
import type { ReviewAnswer, ReviewWrite, ReviewWriteError } from './reviewWrite';
import type { FeedbackPostResult } from './sendFeedbackPost';
import type { FeedbackPostVariables } from './submitFeedbackPost';

// The mutation cache holds untyped mutations, so the entry is read off their variables by shape
const writesEntry =
  (entryId: string) =>
  ({ state: { variables } }: Mutation) =>
    typeof variables === 'object' &&
    variables !== null &&
    'entryId' in variables &&
    variables.entryId === entryId;

// A new write on an entry forgets the one before, so each entry has one write at most
export function findReviewWrite(
  queryClient: QueryClient,
  gameId: string,
  entryId: string
) {
  return queryClient
    .getMutationCache()
    .find<ReviewAnswer, ReviewWriteError, ReviewWrite>({
      mutationKey: reviewWritesKey(gameId),
      predicate: writesEntry(entryId),
    });
}

export function forgetReviewWrite(
  queryClient: QueryClient,
  gameId: string,
  entryId: string
) {
  const write = findReviewWrite(queryClient, gameId, entryId);
  if (write) {
    queryClient.getMutationCache().remove(write);
  }
}

export function findFeedbackPost(queryClient: QueryClient, entryId: string) {
  return queryClient
    .getMutationCache()
    .find<FeedbackPostResult | null, Error, FeedbackPostVariables>({
      mutationKey: feedbackPostsKey,
      predicate: writesEntry(entryId),
    });
}

export function forgetFeedbackPost(queryClient: QueryClient, entryId: string) {
  const post = findFeedbackPost(queryClient, entryId);
  if (post) {
    queryClient.getMutationCache().remove(post);
  }
}
