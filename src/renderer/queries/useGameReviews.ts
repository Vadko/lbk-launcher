import { useInfiniteQuery, useMutationState } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { ReviewFocus } from '../utils/readReviewLink';
import {
  type ReviewWriteState,
  reviewWriteState,
  withReviewWrites,
} from '../utils/withReviewWrites';
import { gameReviewsQueryKey, reviewWritesKey } from './gameReviewsQueryKey';
import { fetchReviewsPage } from './reviewsClient';
import type { ReviewWriteMutation } from './reviewWrite';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useGameReviews(gameId: string, focus: ReviewFocus | null) {
  const writes = useMutationState<ReviewWriteState, ReviewWriteMutation>({
    filters: { mutationKey: reviewWritesKey(gameId) },
    select: reviewWriteState,
  });
  // Outlives the handled link, so the list keeps the linked thread on its first page
  const [pinnedId, setPinnedId] = useState(focus?.feedbackId ?? null);
  if (focus && focus.feedbackId !== pinnedId) {
    setPinnedId(focus.feedbackId);
  }
  // Read off the link itself, so its first render never shows another thread's list
  const threadId = focus?.feedbackId ?? pinnedId;
  const query = useInfiniteQuery({
    queryKey: [...gameReviewsQueryKey(gameId), threadId],
    queryFn: ({ pageParam }) =>
      pageParam === null && threadId
        ? fetchReviewsPage(gameId, null, threadId)
        : fetchReviewsPage(gameId, pageParam),
    initialPageParam: null as string | null,
    // A repeated cursor would re-arm the sentinel after every fetch
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.nextCursor === lastPageParam ? null : lastPage.nextCursor,
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });

  const { fetchNextPage } = query;
  // A next page would cancel the refetch that brings a write's answer, which then never lands
  const loadNextPage = useCallback(
    () => fetchNextPage({ cancelRefetch: false }),
    [fetchNextPage]
  );

  const { data: pages, dataUpdatedAt } = query;
  const data = useMemo(
    () => pages && withReviewWrites(pages, writes, dataUpdatedAt),
    [pages, writes, dataUpdatedAt]
  );

  return { query, data, loadNextPage };
}
