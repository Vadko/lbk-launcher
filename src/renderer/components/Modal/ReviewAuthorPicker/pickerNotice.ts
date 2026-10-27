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

// The spin, claim and author calls never answer most of these; they read as a plain failure
export const FAILURE_NOTICE: Record<ReviewFailure['code'], PickerNotice> = {
  invalid_body: 'failed',
  invalid_hold: 'holdsReleased',
  invalid_candidate: 'nameExpired',
  captcha_failed: 'captchaFailed',
  edit_window_closed: 'failed',
  not_owner: 'failed',
  banned: 'failed',
  not_found: 'failed',
  method_not_allowed: 'failed',
  id_conflict: 'failed',
  nickname_taken: 'nameTaken',
  author_exists: 'failed',
  not_moderated: 'failed',
  author_required: 'failed',
  rate_limit: 'rateLimit',
  internal: 'failed',
  captcha_unavailable: 'captchaUnavailable',
  nicknames_exhausted: 'exhausted',
  unreachable: 'offline',
  bad_response: 'failed',
  no_machine_id: 'failed',
  e2e_mode: 'failed',
};
