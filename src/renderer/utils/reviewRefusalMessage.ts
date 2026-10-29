import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';

// A failure code, a reply whose target is gone, or a verdict on a write the server took
export type ReviewRefusalReason =
  | ReviewFailure['code']
  | 'reply_target_gone'
  | 'edit_rejected'
  | 'removed';

type RefusalMessage =
  | 'editRejected'
  | 'removed'
  | 'banned'
  | 'notFound'
  | 'replyTargetGone'
  | 'editWindowClosed'
  | 'editLimitReached'
  | 'threadFull'
  | 'generic';

const REFUSAL_MESSAGES: Record<ReviewRefusalReason, RefusalMessage> = {
  edit_rejected: 'editRejected',
  removed: 'removed',
  banned: 'banned',
  not_found: 'notFound',
  reply_target_gone: 'replyTargetGone',
  edit_window_closed: 'editWindowClosed',
  edit_limit_reached: 'editLimitReached',
  thread_full: 'threadFull',
  invalid_body: 'generic',
  invalid_hold: 'generic',
  invalid_candidate: 'generic',
  captcha_failed: 'generic',
  not_owner: 'generic',
  method_not_allowed: 'generic',
  id_conflict: 'generic',
  nickname_taken: 'generic',
  author_exists: 'generic',
  not_moderated: 'generic',
  author_required: 'generic',
  rate_limit: 'generic',
  daily_limit: 'generic',
  internal: 'generic',
  captcha_unavailable: 'generic',
  nicknames_exhausted: 'generic',
  unreachable: 'generic',
  bad_response: 'generic',
  no_machine_id: 'generic',
  e2e_mode: 'generic',
};

export function reviewRefusalMessage(reason: ReviewRefusalReason): string {
  return t(`gameReviews.rejected.${REFUSAL_MESSAGES[reason]}`);
}
