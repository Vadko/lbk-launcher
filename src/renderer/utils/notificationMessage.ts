import { t } from '@/shared/i18n/i18n';
import type { NoticeContent } from '../store/subscriptions/types';
import { reviewRefusalMessage } from './reviewRefusalMessage';
import { reviewReplyText } from './reviewReplyText';
import { statusLabel } from './statusLabel';

const MESSAGES: Record<NoticeContent['type'], (notice: NoticeContent) => string> = {
  'status-change': ({ newValue }) =>
    t('notificationMessage.statusChange', { status: statusLabel(newValue ?? '') }),
  'version-update': ({ newValue }) =>
    t('notifications.versionAvailable', { version: newValue ?? '' }),
  'app-update': ({ newValue }) =>
    t('notifications.versionAvailable', { version: newValue ?? '' }),
  'progress-change': ({ progress, newValue }) =>
    progress
      ? t('notifications.progressChange', {
          kind: t(`translationProgress.${progress.kind}`),
          from: progress.from,
          to: progress.to,
        })
      : t('notificationMessage.progressChange', { progress: newValue ?? '' }),
  'team-new-game': ({ teamName }) =>
    t('notifications.teamNewGame', { team: teamName ?? '' }),
  'team-status-change': ({ teamName, newValue }) =>
    t('notifications.teamStatusChange', {
      team: teamName ?? '',
      status: statusLabel(newValue ?? ''),
    }),
  'first-favorite': () => t('notificationMessage.firstFavorite'),
  'feedback-reply': ({ reply, message }) =>
    reply ? reviewReplyText(reply) : (message ?? t('notificationMessage.feedbackReply')),
  'review-rejected': ({ refusalReason, message }) =>
    refusalReason
      ? reviewRefusalMessage(refusalReason)
      : (message ?? t('gameReviews.rejected.generic')),
  'review-published': () => t('notificationMessage.reviewPublished'),
};

// Worded when shown, so a notice follows the language it is read in
export function notificationMessage(notice: NoticeContent): string {
  return MESSAGES[notice.type](notice);
}
