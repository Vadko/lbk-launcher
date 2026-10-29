import { describe, expect, it } from 'vitest';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import { t } from '@/shared/i18n/i18n';
import { feedbackFailureMessage } from './feedbackFailureMessage';

describe('feedbackFailureMessage', () => {
  const failures: [ReviewFailure['code'], string][] = [
    ['banned', t('gameReviews.rejected.banned')],
    ['captcha_failed', t('feedbackModal.captchaFailed')],
    ['captcha_unavailable', t('reviewAuthorPicker.notice.captchaUnavailable')],
    ['not_found', t('feedbackModal.gameUnavailable')],
    ['author_required', t('feedbackModal.authorRequired')],
    ['daily_limit', t('feedbackModal.dailyLimit')],
    ['rate_limit', t('feedbackModal.rateLimit')],
    ['unreachable', t('feedbackModal.networkError')],
    ['invalid_body', t('feedbackModal.sendFailed')],
    ['invalid_hold', t('feedbackModal.sendFailed')],
    ['invalid_candidate', t('feedbackModal.sendFailed')],
    ['edit_window_closed', t('feedbackModal.sendFailed')],
    ['not_owner', t('feedbackModal.sendFailed')],
    ['edit_limit_reached', t('feedbackModal.sendFailed')],
    ['thread_full', t('feedbackModal.sendFailed')],
    ['method_not_allowed', t('feedbackModal.sendFailed')],
    ['id_conflict', t('feedbackModal.sendFailed')],
    ['nickname_taken', t('feedbackModal.sendFailed')],
    ['author_exists', t('feedbackModal.sendFailed')],
    ['not_moderated', t('feedbackModal.sendFailed')],
    ['internal', t('feedbackModal.sendFailed')],
    ['nicknames_exhausted', t('feedbackModal.sendFailed')],
    ['bad_response', t('feedbackModal.sendFailed')],
    ['no_machine_id', t('feedbackModal.sendFailed')],
    ['e2e_mode', t('feedbackModal.sendFailed')],
  ];

  it.each(failures)('%s reads as its message on a public post', (code, message) => {
    expect(feedbackFailureMessage({ code, kind: 'rejected' }, true)).toBe(message);
  });

  it.each(failures.filter(([code]) => code !== 'not_found'))(
    '%s reads the same on a private post',
    (code, message) => {
      expect(feedbackFailureMessage({ code, kind: 'rejected' }, false)).toBe(message);
    }
  );

  it('tells a private post on a deleted translation that it is gone, not that it cannot be published', () => {
    expect(feedbackFailureMessage({ code: 'not_found', kind: 'rejected' }, false)).toBe(
      t('feedbackModal.gameRemoved')
    );
  });
});
