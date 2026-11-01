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
    ['internal', t('feedbackModal.sendFailed')],
    ['bad_response', t('feedbackModal.sendFailed')],
  ];

  it.each(failures)('%s reads as its message on a public post', (code, message) => {
    expect(feedbackFailureMessage({ code, kind: 'rejected' }, true, 'feedback')).toBe(
      message
    );
  });

  it.each(failures.filter(([code]) => code !== 'not_found'))(
    '%s reads the same on a private post',
    (code, message) => {
      expect(feedbackFailureMessage({ code, kind: 'rejected' }, false, 'feedback')).toBe(
        message
      );
    }
  );

  it.each(failures)(
    '%s on an error report reads as its message, the report variant where it names the post',
    (code, message) => {
      const expected =
        message === t('feedbackModal.sendFailed')
          ? t('feedbackModal.sendFailed_error')
          : message;
      expect(feedbackFailureMessage({ code, kind: 'rejected' }, true, 'error')).toBe(
        expected
      );
    }
  );

  it.each([
    ['feedback', 'feedbackModal.gameRemoved'],
    ['error', 'feedbackModal.gameRemoved_error'],
  ] as const)(
    'tells a private %s on a deleted translation that it is gone, not that it cannot be published',
    (type, key) => {
      expect(
        feedbackFailureMessage({ code: 'not_found', kind: 'rejected' }, false, type)
      ).toBe(t(key));
    }
  );
});
