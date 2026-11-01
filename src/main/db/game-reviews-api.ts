import type {
  GameReviewsListInput,
  ReviewResult,
} from '../../shared/game-reviews-api-types';
import { type GameReviewsPage, reviewsPageSchema } from '../../shared/game-reviews-types';
import { callReviewFunction } from './review-request';
import { withFocus } from './with-focus';

export function fetchGameReviews({
  gameId,
  cursor,
  focusId,
}: GameReviewsListInput): Promise<ReviewResult<GameReviewsPage>> {
  return callReviewFunction(
    'reviews?action=list',
    { gameId, cursor, focusId },
    reviewsPageSchema.transform(withFocus)
  );
}
