import type {
  ReviewEditInput,
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
} from '../../shared/game-reviews-api-types';
import { callReviewFunction } from './review-request';
import { writeResultSchema } from './review-schemas';

export function replyToReview({
  id,
  reviewId,
  parentId,
  text,
}: ReviewReplyInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction(
    'reviews?action=reply',
    { id, reviewId, parentId, text },
    writeResultSchema
  );
}

// The answer for a published public entry reads 'published' whether moderation kept the edit or not
export function editReviewEntry({
  id,
  text,
}: ReviewEditInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction('reviews?action=edit', { id, text }, writeResultSchema);
}
