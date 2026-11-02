import { infiniteQueryOptions } from '@tanstack/react-query';
import type { FeedbackType } from '@/shared/types';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { fetchReviewsPage } from './reviewsClient';

const THIRTY_MINUTES = 30 * 60 * 1000;

// threadId is a review link's thread, sent with the first page only; type null lists every thread
export const gameReviewsQueryOptions = (
  gameId: string,
  threadId: string | null,
  type: FeedbackType | null
) =>
  infiniteQueryOptions({
    queryKey: [...gameReviewsQueryKey(gameId), threadId, type],
    queryFn: ({ pageParam }) =>
      fetchReviewsPage({
        gameId,
        cursor: pageParam,
        focusId: pageParam === null && threadId ? threadId : undefined,
        type: type ?? undefined,
      }),
    initialPageParam: null as string | null,
    // A repeated cursor would re-arm the sentinel after every fetch
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.nextCursor === lastPageParam ? null : lastPage.nextCursor,
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
