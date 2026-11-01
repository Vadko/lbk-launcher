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
    ['captcha_failed', t('gameReviews.rejected.generic')],
    ['internal', t('gameReviews.rejected.generic')],
  ])('%s reads as its message', (reason, message) => {
    expect(reviewRefusalMessage(reason)).toBe(message);
  });
});
