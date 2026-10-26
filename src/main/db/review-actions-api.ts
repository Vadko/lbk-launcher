import type {
  ReviewEditInput,
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
} from '../../shared/game-reviews-api-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { callReviewFunction } from './review-request';
import { writeResultSchema } from './review-schemas';

export function replyToReview({
  id,
  reviewId,
  parentId,
  text,
  isPublic,
}: ReviewReplyInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction(
    'reviews?action=reply',
    { id, reviewId, parentId, text },
    writeResultSchema,
    isPublic ? { captchaToken: () => takeCaptchaToken('reply') } : {}
  );
}

// The answer for a published public entry reads 'published' whether moderation kept the edit or not
export function editReviewEntry({
  id,
  text,
  isPublic,
}: ReviewEditInput): Promise<ReviewResult<ReviewWriteResult>> {
  return callReviewFunction(
    'reviews?action=edit',
    { id, text },
    writeResultSchema,
    isPublic ? { captchaToken: () => takeCaptchaToken('edit') } : {}
  );
}
