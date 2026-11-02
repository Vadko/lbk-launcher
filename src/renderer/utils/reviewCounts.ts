import type { FeedbackType, Game } from '@/shared/types';

export type ReviewCounts = Record<FeedbackType | 'all', number>;

export const reviewCounts = (game: Game): ReviewCounts =>
  game.hide
    ? { all: 0, feedback: 0, error: 0 }
    : {
        all: game.reviews,
        feedback: game.reviews - game.error_reviews,
        error: game.error_reviews,
      };
