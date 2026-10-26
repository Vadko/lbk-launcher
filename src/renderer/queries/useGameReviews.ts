import { useInfiniteQuery } from '@tanstack/react-query';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { fetchReviewsPage } from './reviewsClient';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useGameReviews(gameId: string) {
  return useInfiniteQuery({
    queryKey: gameReviewsQueryKey(gameId),
    queryFn: ({ pageParam }) => fetchReviewsPage(gameId, pageParam),
    initialPageParam: null as string | null,
    // A repeated cursor would re-arm the sentinel after every fetch
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.nextCursor === lastPageParam ? null : lastPage.nextCursor,
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
}
