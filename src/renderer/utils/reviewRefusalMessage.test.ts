import { describe, expect, it } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import { type ReviewRefusalReason, reviewRefusalMessage } from './reviewRefusalMessage';

describe('reviewRefusalMessage', () => {
  it.each<[ReviewRefusalReason, string]>([
    ['edit_rejected', t('gameReviews.rejected.editRejected')],
    ['removed', t('gameReviews.rejected.removed')],
    ['banned', t('gameReviews.rejected.banned')],
    ['not_found', t('gameReviews.rejected.notFound')],
    ['reply_target_gone', t('gameReviews.rejected.replyTargetGone')],
    ['edit_window_closed', t('gameReviews.rejected.editWindowClosed')],
    ['edit_limit_reached', t('gameReviews.rejected.editLimitReached')],
    ['thread_full', t('gameReviews.rejected.threadFull')],
    ['invalid_body', t('gameReviews.rejected.generic')],
    ['invalid_hold', t('gameReviews.rejected.generic')],
    ['invalid_candidate', t('gameReviews.rejected.generic')],
    ['captcha_failed', t('gameReviews.rejected.generic')],
    ['not_owner', t('gameReviews.rejected.generic')],
    ['method_not_allowed', t('gameReviews.rejected.generic')],
    ['id_conflict', t('gameReviews.rejected.generic')],
    ['nickname_taken', t('gameReviews.rejected.generic')],
    ['author_exists', t('gameReviews.rejected.generic')],
    ['not_moderated', t('gameReviews.rejected.generic')],
    ['author_required', t('gameReviews.rejected.generic')],
    ['rate_limit', t('gameReviews.rejected.generic')],
    ['daily_limit', t('gameReviews.rejected.generic')],
    ['internal', t('gameReviews.rejected.generic')],
    ['captcha_unavailable', t('gameReviews.rejected.generic')],
    ['nicknames_exhausted', t('gameReviews.rejected.generic')],
    ['unreachable', t('gameReviews.rejected.generic')],
    ['bad_response', t('gameReviews.rejected.generic')],
    ['no_machine_id', t('gameReviews.rejected.generic')],
    ['e2e_mode', t('gameReviews.rejected.generic')],
  ])('%s reads as its message', (reason, message) => {
    expect(reviewRefusalMessage(reason)).toBe(message);
  });
});
