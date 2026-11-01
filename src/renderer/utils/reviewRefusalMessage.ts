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
  | 'threadFull';

// Every other reason reads as the generic refusal
const REFUSAL_MESSAGES: Partial<Record<ReviewRefusalReason, RefusalMessage>> = {
  edit_rejected: 'editRejected',
  removed: 'removed',
  banned: 'banned',
  not_found: 'notFound',
  reply_target_gone: 'replyTargetGone',
  edit_window_closed: 'editWindowClosed',
  edit_limit_reached: 'editLimitReached',
  thread_full: 'threadFull',
};

export function reviewRefusalMessage(reason: ReviewRefusalReason): string {
  return t(`gameReviews.rejected.${REFUSAL_MESSAGES[reason] ?? 'generic'}`);
}
