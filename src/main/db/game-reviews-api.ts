import { app } from 'electron';
import type {
  GameReviewsListInput,
  ReviewResult,
} from '../../shared/game-reviews-api-types';
import { type GameReviewsPage, reviewsPageSchema } from '../../shared/game-reviews-types';
import { callReviewFunction } from './review-request';
import { withFocus } from './with-focus';

// The version lets the server keep enum values this launcher cannot parse out of its page
export function fetchGameReviews({
  gameId,
  cursor,
  focusId,
  type,
}: GameReviewsListInput): Promise<ReviewResult<GameReviewsPage>> {
  return callReviewFunction(
    'reviews?action=list',
    { gameId, cursor, focusId, type, version: app.getVersion() },
    reviewsPageSchema.transform(withFocus)
  );
}
