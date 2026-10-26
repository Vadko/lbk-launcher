import { z } from 'zod';
import type {
  NicknameClaimInput,
  NicknameSpin,
  NicknameSpinInput,
  ReviewAuthorState,
  ReviewResult,
} from '../../shared/game-reviews-api-types';
import type { ReviewAuthorIdentity } from '../../shared/game-reviews-types';
import { takeCaptchaToken } from '../turnstile/tokens';
import { callReviewFunction } from './review-request';
import { authorIdentitySchema } from './review-schemas';

const authorStateSchema: z.ZodType<ReviewAuthorState> = z.object({
  author: authorIdentitySchema.nullable(),
  spinsLeft: z.number(),
});

const spinSchema: z.ZodType<NicknameSpin> = z.object({
  spinId: z.string(),
  avatarSeed: z.string(),
  adjective: z.string(),
  noun: z.string(),
  name: z.string(),
  decoys: z.object({
    avatarSeeds: z.array(z.string()),
    adjectives: z.array(z.string()),
    nouns: z.array(z.string()),
  }),
  spinsLeft: z.number(),
});

const claimSchema: z.ZodType<ReviewAuthorIdentity> = z
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
    spinSchema
  );
}

// An existing author answers at once and spends no captcha, so a resend is safe
export function claimReviewNickname({
  spinId,
}: NicknameClaimInput): Promise<ReviewResult<ReviewAuthorIdentity>> {
  return callReviewFunction('reviews?action=claim', { spinId }, claimSchema, {
    captchaToken: () => takeCaptchaToken('nickname'),
  });
}
