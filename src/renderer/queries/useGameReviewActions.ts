import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReviewAuthorIdentity } from '@/shared/game-reviews-types';
import { createReviewActions } from './createReviewActions';
import { reviewWriteOptions } from './reviewWrite';

export function useGameReviewActions(
  gameId: string,
  gameName: string,
  viewer: ReviewAuthorIdentity | null
) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation(reviewWriteOptions(queryClient, gameId, gameName));

  return useMemo(
    () => createReviewActions(queryClient, gameId, mutate, viewer),
    [queryClient, gameId, mutate, viewer]
  );
}
