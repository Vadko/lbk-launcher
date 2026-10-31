import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import type { FeedbackType } from '@/shared/types';

type FeedbackFailureText =
  | 'gameReviews.rejected.banned'
  | 'reviewAuthorPicker.notice.captchaUnavailable'
  | 'feedbackModal.captchaFailed'
  | 'feedbackModal.gameUnavailable'
  | 'feedbackModal.authorRequired'
  | 'feedbackModal.dailyLimit'
  | 'feedbackModal.rateLimit'
  | 'feedbackModal.networkError'
  | 'feedbackModal.sendFailed';

const FEEDBACK_FAILURES: Record<ReviewFailure['code'], FeedbackFailureText> = {
  // A ban covers private posts too
  banned: 'gameReviews.rejected.banned',
  captcha_failed: 'feedbackModal.captchaFailed',
  captcha_unavailable: 'reviewAuthorPicker.notice.captchaUnavailable',
  not_found: 'feedbackModal.gameUnavailable',
  author_required: 'feedbackModal.authorRequired',
  daily_limit: 'feedbackModal.dailyLimit',
  rate_limit: 'feedbackModal.rateLimit',
  unreachable: 'feedbackModal.networkError',
  invalid_body: 'feedbackModal.sendFailed',
  invalid_hold: 'feedbackModal.sendFailed',
  invalid_candidate: 'feedbackModal.sendFailed',
  edit_window_closed: 'feedbackModal.sendFailed',
  not_owner: 'feedbackModal.sendFailed',
  edit_limit_reached: 'feedbackModal.sendFailed',
  thread_full: 'feedbackModal.sendFailed',
  method_not_allowed: 'feedbackModal.sendFailed',
  id_conflict: 'feedbackModal.sendFailed',
  nickname_taken: 'feedbackModal.sendFailed',
  author_exists: 'feedbackModal.sendFailed',
  not_moderated: 'feedbackModal.sendFailed',
  internal: 'feedbackModal.sendFailed',
  nicknames_exhausted: 'feedbackModal.sendFailed',
  bad_response: 'feedbackModal.sendFailed',
  no_machine_id: 'feedbackModal.sendFailed',
  e2e_mode: 'feedbackModal.sendFailed',
};

export function feedbackFailureMessage(
  failure: ReviewFailure,
  allowPublish: boolean,
  type: FeedbackType
): string {
  // post_review refuses a public post on a hidden, unapproved or deleted translation, a private one only on a deleted one
  if (failure.code === 'not_found' && !allowPublish) {
    return t('feedbackModal.gameRemoved', { context: type });
  }
  const key = FEEDBACK_FAILURES[failure.code];
  // Only the generic refusal names what was sent, so only it reads per type
  return key === 'feedbackModal.sendFailed' ? t(key, { context: type }) : t(key);
}
