import { useInfiniteQuery, useMutationState } from '@tanstack/react-query';
import { useState } from 'react';
import type { FeedbackType } from '@/shared/types';
import type { ReviewFocus } from '../utils/readReviewLink';
import {
  type ReviewWriteState,
  reviewWriteState,
  withReviewWrites,
} from '../utils/withReviewWrites';
import { reviewWritesKey } from './gameReviewsQueryKey';
import { gameReviewsQueryOptions } from './gameReviewsQueryOptions';
import type { ReviewWriteMutation } from './reviewWrite';

export function useGameReviews(
  gameId: string,
  focus: ReviewFocus | null,
  type: FeedbackType | null
) {
  const writes = useMutationState<ReviewWriteState, ReviewWriteMutation>({
    filters: { mutationKey: reviewWritesKey(gameId) },
    select: reviewWriteState,
  });
  // Outlives the handled link, so the list keeps the linked thread on its first page
  const [pinnedId, setPinnedId] = useState(focus?.feedbackId ?? null);
  if (focus && focus.feedbackId !== pinnedId) {
    setPinnedId(focus.feedbackId);
  }
  // Read off the link itself, so its first render never shows another thread's list; a type filter drops it
  const threadId = type ? null : (focus?.feedbackId ?? pinnedId);
  const query = useInfiniteQuery(gameReviewsQueryOptions(gameId, threadId, type));

  const { fetchNextPage } = query;
  // A next page would cancel the refetch that brings a write's answer, which then never lands
  const loadNextPage = () => fetchNextPage({ cancelRefetch: false });

  const { data: pages } = query;
  const data = pages && withReviewWrites(pages, writes);

  return { query, data, loadNextPage };
}
