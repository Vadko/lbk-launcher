export const allGameReviewsQueryKey = ['game-reviews'] as const;

export const gameReviewsQueryKey = (gameId: string) =>
  [...allGameReviewsQueryKey, gameId] as const;
