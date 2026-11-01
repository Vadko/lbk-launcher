import {
  editResultSchema,
  type ReviewEditInput,
  type ReviewEditResult,
  type ReviewReplyInput,
  type ReviewResult,
  type ReviewWriteResult,
  writeResultSchema,
} from '../../shared/game-reviews-api-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { callReviewFunction } from './review-request';

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
    isPublic ? () => takeCaptchaToken('reply') : undefined
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
    isPublic ? () => takeCaptchaToken('edit') : undefined
  );
}
