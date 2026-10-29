import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import type { ReviewPages } from '../utils/reviewCache';
import { applyOverlay, NO_REVIEW_WRITES } from '../utils/reviewOverlay';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { fetchReviewsPage } from './reviewsClient';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useGameReviews(gameId: string) {
  const writes = useReviewOverlayStore(
    (state) => state.games.get(gameId) ?? NO_REVIEW_WRITES
  );
  // React Query reruns select only when the data or this function changes, so it follows this game's writes
  const select = useCallback((data: ReviewPages) => applyOverlay(data, writes), [writes]);
  return useInfiniteQuery({
    queryKey: gameReviewsQueryKey(gameId),
    queryFn: ({ pageParam }) => fetchReviewsPage(gameId, pageParam),
    initialPageParam: null as string | null,
    // A repeated cursor would re-arm the sentinel after every fetch
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.nextCursor === lastPageParam ? null : lastPage.nextCursor,
    select,
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });
}
