import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createReviewActions } from './createReviewActions';

export function useGameReviewActions(gameId: string, gameName: string) {
  const queryClient = useQueryClient();

  return useMemo(
    () => createReviewActions(queryClient, gameId, gameName),
    [gameId, gameName, queryClient]
  );
}
