import {
  useInfiniteQuery,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type FocusAsk, focusRefresh } from '../utils/focusRefresh';
import type { ReviewFocus } from '../utils/readReviewLink';
import type { ReviewCachePage, ReviewPages } from '../utils/reviewCache';
import {
  type ReviewWriteState,
  reviewWriteState,
  withReviewWrites,
} from '../utils/withReviewWrites';
import { gameReviewsQueryKey, reviewWritesKey } from './gameReviewsQueryKey';
import { refreshGameReviews } from './refreshGameReviews';
import { fetchReviewsPage } from './reviewsClient';
import type { ReviewWriteMutation } from './reviewWrite';

const THIRTY_MINUTES = 30 * 60 * 1000;

export function useGameReviews(gameId: string, focus: ReviewFocus | null) {
  const queryClient = useQueryClient();
  const writes = useMutationState<ReviewWriteState, ReviewWriteMutation>({
    filters: { mutationKey: reviewWritesKey(gameId) },
    select: reviewWriteState,
  });
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

  // A refetch a write or an event asks for clears the query's error, so the failed page is remembered here
  const [isLoadMoreFailed, setIsLoadMoreFailed] = useState(false);
  const { fetchNextPage } = query;
  const loadNextPage = useCallback(async () => {
    const loaded =
      queryClient.getQueryData<ReviewPages>(gameReviewsQueryKey(gameId))?.pages.length ??
      0;
    // A next page would cancel the refetch that brings the linked thread or a write's answer
    const options = { cancelRefetch: false };
    const first = await fetchNextPage(options);
    // A call made while that refresh is out hands back the refresh's own result, with no page added
    const isJoined =
      first.hasNextPage &&
      !first.isFetchNextPageError &&
      (first.data?.pages.length ?? 0) <= loaded;
    const result = isJoined ? await fetchNextPage(options) : first;
    setIsLoadMoreFailed(result.isFetchNextPageError);
    return result;
  }, [queryClient, gameId, fetchNextPage]);

  const { data: pages, dataUpdatedAt } = query;
  const data = useMemo(
    () => pages && withReviewWrites(pages, writes, dataUpdatedAt),
    [pages, writes, dataUpdatedAt]
  );

  return { query, data, loadNextPage, isLoadMoreFailed, failedFocusKey };
}
