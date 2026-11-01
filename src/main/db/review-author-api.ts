import { z } from 'zod';
import {
  authorStateSchema,
  type NicknameClaimInput,
  type NicknameSpin,
  type NicknameSpinInput,
  nicknameSpinSchema,
  type ReviewAuthorState,
  type ReviewResult,
} from '../../shared/game-reviews-api-types';
import {
  authorIdentitySchema,
  type ReviewAuthorIdentity,
} from '../../shared/game-reviews-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { callReviewFunction } from './review-request';

const claimSchema = z
  .object({ author: authorIdentitySchema })
  .transform(({ author }) => author);

export function getReviewAuthor(): Promise<ReviewResult<ReviewAuthorState>> {
  return callReviewFunction('reviews?action=author', {}, authorStateSchema);
}

// Not idempotent: every call is a new spin that counts toward the machine's hourly limit
export function spinReviewNickname({
  spinId,
  hold,
}: NicknameSpinInput): Promise<ReviewResult<NicknameSpin>> {
  return callReviewFunction(
    'reviews?action=spin',
    {
      spinId,
      hold: { avatar: hold.avatar, adjective: hold.adjective, noun: hold.noun },
    },
    nicknameSpinSchema
  );
}

// An existing author answers at once and spends no captcha, so a resend is safe
export function claimReviewNickname({
  spinId,
}: NicknameClaimInput): Promise<ReviewResult<ReviewAuthorIdentity>> {
  return callReviewFunction('reviews?action=claim', { spinId }, claimSchema, () =>
    takeCaptchaToken('nickname')
  );
}
