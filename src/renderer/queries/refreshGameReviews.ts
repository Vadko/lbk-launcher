import type { QueryClient } from '@tanstack/react-query';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';

// An invalidate joins a first load instead of restarting it, which would land with what it read before
export function refreshGameReviews(queryClient: QueryClient, gameId: string): void {
  const queryKey = gameReviewsQueryKey(gameId);
  const state = queryClient.getQueryState(queryKey);
  if (state && state.data === undefined && state.fetchStatus === 'fetching') {
    void queryClient
      .cancelQueries({ queryKey })
      .then(() => queryClient.invalidateQueries({ queryKey }));
    return;
  }
  void queryClient.invalidateQueries({ queryKey });
}
