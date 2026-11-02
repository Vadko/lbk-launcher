import type { ReviewFailure } from '@/shared/game-reviews-api-types';

// Keys of reviewAuthorPicker.notice
export type PickerNotice =
  | 'nameTaken'
  | 'nameExpired'
  | 'holdsReleased'
  | 'wordsReleased'
  | 'exhausted'
  | 'rateLimit'
  | 'captchaFailed'
  | 'captchaUnavailable'
  | 'offline'
  | 'failed';

// The info notices explain a respin the picker did by itself; the rest say what failed
export const NOTICE_TONE: Record<PickerNotice, 'info' | 'error'> = {
  nameTaken: 'info',
  nameExpired: 'info',
  holdsReleased: 'info',
  wordsReleased: 'info',
  exhausted: 'error',
  rateLimit: 'error',
  captchaFailed: 'error',
  captchaUnavailable: 'error',
  offline: 'error',
  failed: 'error',
};

// The few codes the spin, claim and author calls answer with a notice of their own; the rest read as a plain failure
const FAILURE_NOTICE: Partial<Record<ReviewFailure['code'], PickerNotice>> = {
  invalid_hold: 'holdsReleased',
  invalid_candidate: 'nameExpired',
  captcha_failed: 'captchaFailed',
  nickname_taken: 'nameTaken',
  rate_limit: 'rateLimit',
  captcha_unavailable: 'captchaUnavailable',
  nicknames_exhausted: 'exhausted',
  unreachable: 'offline',
};

export const failureNotice = (code: ReviewFailure['code'] | null): PickerNotice =>
  (code && FAILURE_NOTICE[code]) ?? 'failed';
