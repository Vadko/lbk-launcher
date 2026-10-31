import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { type FocusAsk, focusRefresh } from '../utils/focusRefresh';
import type { ReviewFocus } from '../utils/readReviewLink';
import type { ReviewCachePage, ReviewPages } from '../utils/reviewCache';
import { applyOverlay, NO_REVIEW_WRITES, NO_ROLLED_BACK } from '../utils/reviewOverlay';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { refreshGameReviews } from './refreshGameReviews';
import { fetchReviewsPage } from './reviewsClient';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useGameReviews(gameId: string, focus: ReviewFocus | null) {
  const queryClient = useQueryClient();
  const writes = useReviewOverlayStore(
    (state) => state.games.get(gameId) ?? NO_REVIEW_WRITES
  );
  const rolledBack = useReviewOverlayStore(
    (state) => state.rolledBack.get(gameId) ?? NO_ROLLED_BACK
  );
  // React Query reruns select only when the data or this function changes, so it follows this game's writes
  const select = useCallback(
    (data: ReviewPages) => applyOverlay(data, writes, rolledBack),
    [writes, rolledBack]
  );
  // Outlives the handled link, so a later refetch keeps the linked thread on the first page
  const [pinned, setPinned] = useState(focus);
  if (focus && focus.key !== pinned?.key) {
    setPinned(focus);
  }
  const query = useInfiniteQuery({
    queryKey: gameReviewsQueryKey(gameId),
    queryFn: async ({ pageParam }): Promise<ReviewCachePage> => {
      if (pageParam !== null || !pinned) {
        return fetchReviewsPage(gameId, pageParam);
      }
      const page = await fetchReviewsPage(gameId, null, pinned.feedbackId);
      return { ...page, focusKey: pinned.key };
    },
    initialPageParam: null as string | null,
    // A repeated cursor would re-arm the sentinel after every fetch
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.nextCursor === lastPageParam ? null : lastPage.nextCursor,
    select,
    staleTime: THIRTY_MINUTES,
    gcTime: THIRTY_MINUTES,
  });

  // The focus is not in the key and the pages stay fresh for 30 minutes, so a link has to ask again
  const [ask, setAsk] = useState<FocusAsk | null>(null);
  const [failedFocusKey, setFailedFocusKey] = useState<string | null>(null);
  if (focus) {
    const { data, isFetching, isRefetchError, dataUpdatedAt, errorUpdateCount } = query;
    const step = focusRefresh({
      focusKey: focus.key,
      failedKey: failedFocusKey,
      ask,
      query: {
        hasData: data !== undefined,
        pageFocusKey: data?.pages[0]?.focusKey,
        isFetching,
        isRefetchError,
        dataUpdatedAt,
        errorUpdateCount,
      },
    });
    if (step === 'refresh') {
      setAsk({ focusKey: focus.key, dataUpdatedAt, errorUpdateCount });
    } else if (step === 'give-up' && failedFocusKey !== focus.key) {
      setFailedFocusKey(focus.key);
    }
  }
  useEffect(() => {
    if (ask) {
      refreshGameReviews(queryClient, gameId);
    }
  }, [ask, queryClient, gameId]);

  // A cache patch from a taken write clears the query's error, so the failed page is remembered here
  const [isLoadMoreFailed, setIsLoadMoreFailed] = useState(false);
  const { fetchNextPage } = query;
  const isFocusPending = focus !== null;
  const loadNextPage = useCallback(async () => {
    const loaded =
      queryClient.getQueryData<ReviewPages>(gameReviewsQueryKey(gameId))?.pages.length ??
      0;
    // A next page would cancel the refresh that brings the linked thread
    const options = { cancelRefetch: !isFocusPending };
    const first = await fetchNextPage(options);
    // A call made while that refresh is out hands back the refresh's own result, with no page added
    const isJoined =
      first.hasNextPage &&
      !first.isFetchNextPageError &&
      (first.data?.pages.length ?? 0) <= loaded;
    const result = isJoined ? await fetchNextPage(options) : first;
    setIsLoadMoreFailed(result.isFetchNextPageError);
    return result;
  }, [queryClient, gameId, fetchNextPage, isFocusPending]);

  return { query, loadNextPage, isLoadMoreFailed, failedFocusKey };
}
