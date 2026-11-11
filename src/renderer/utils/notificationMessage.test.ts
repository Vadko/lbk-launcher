import { describe, expect, it } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { NoticeContent } from '../store/subscriptions/types';
import { notificationMessage } from './notificationMessage';
import { reviewRefusalMessage } from './reviewRefusalMessage';

const notice = (fields: Omit<NoticeContent, 'gameName'>): NoticeContent => ({
  gameName: 'Game',
  ...fields,
});

describe('notificationMessage', () => {
  it.each([
    [
      'a status from the raw value',
      notice({ type: 'status-change', newValue: 'completed' }),
      t('notificationMessage.statusChange', { status: t('gameStatus.completed') }),
    ],
    [
      'a status an older launcher stored as its label',
      notice({ type: 'status-change', newValue: 'Done' }),
      t('notificationMessage.statusChange', { status: 'Done' }),
    ],
    [
      'a team status from the raw value',
      notice({ type: 'team-status-change', teamName: 'Team', newValue: 'in-progress' }),
      t('notifications.teamStatusChange', {
        team: 'Team',
        status: t('gameStatus.in-progress'),
      }),
    ],
    [
      'progress from its kind and values',
      notice({ type: 'progress-change', progress: { kind: 'voice', from: 10, to: 40 } }),
      t('notifications.progressChange', {
        kind: t('translationProgress.voice'),
        from: 10,
        to: 40,
      }),
    ],
    [
      'progress an older launcher stored worded',
      notice({ type: 'progress-change', newValue: 'Voice: 40%' }),
      t('notificationMessage.progressChange', { progress: 'Voice: 40%' }),
    ],
    [
      'a reply from its author and text',
      notice({
        type: 'feedback-reply',
        reply: { authorRole: 'player', authorName: 'Nick', message: 'thanks' },
      }),
      t('notifications.replyBy', { name: 'Nick', message: 'thanks' }),
    ],
    [
      'a reply an older launcher stored worded',
      notice({ type: 'feedback-reply', message: 'Nick: thanks' }),
      'Nick: thanks',
    ],
    [
      'a refusal from its reason',
      notice({ type: 'review-rejected', refusalReason: 'removed' }),
      reviewRefusalMessage('removed'),
    ],
    [
      'a refusal an older launcher stored worded',
      notice({ type: 'review-rejected', message: 'refused' }),
      'refused',
    ],
    [
      'a refusal with nothing stored',
      notice({ type: 'review-rejected' }),
      t('gameReviews.rejected.generic'),
    ],
    [
      'a version',
      notice({ type: 'version-update', newValue: '1.2' }),
      t('notifications.versionAvailable', { version: '1.2' }),
    ],
  ])('words %s', (_, content, expected) => {
    expect(notificationMessage(content)).toBe(expected);
  });
});
