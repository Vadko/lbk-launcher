export const gameReviewsQueryKey = (gameId: string) => ['game-reviews', gameId] as const;

export const reviewWritesKey = (gameId: string) => ['review-writes', gameId] as const;

export const feedbackPostsKey = ['feedback-posts'] as const;
