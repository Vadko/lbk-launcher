import type { QueryClient } from '@tanstack/react-query';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';

// An invalidate joins a first load instead of restarting it, which would land with what it read before
export function refreshGameReviews(queryClient: QueryClient, gameId: string): void {
  const queryKey = gameReviewsQueryKey(gameId);
  void queryClient
    .cancelQueries({ queryKey, predicate: ({ state }) => state.data === undefined })
    .then(() => queryClient.invalidateQueries({ queryKey }));
}
