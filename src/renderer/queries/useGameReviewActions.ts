import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createReviewActions } from './createReviewActions';

export function useGameReviewActions(gameId: string) {
  const queryClient = useQueryClient();

  return useMemo(() => createReviewActions(queryClient, gameId), [gameId, queryClient]);
}
