import type {
  ReviewEditInput,
  ReviewEditResult,
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
} from '../../shared/game-reviews-api-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { callReviewFunction } from './review-request';
import { editResultSchema, writeResultSchema } from './review-schemas';

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

export function editReviewEntry({
  id,
  text,
  isPublic,
}: ReviewEditInput): Promise<ReviewResult<ReviewEditResult>> {
  return callReviewFunction(
    'reviews?action=edit',
    { id, text },
    editResultSchema,
    isPublic ? { captchaToken: () => takeCaptchaToken('edit') } : {}
  );
}
