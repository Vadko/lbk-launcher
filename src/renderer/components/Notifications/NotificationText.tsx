import { Trans } from 'react-i18next';
import { t } from '@/shared/i18n/i18n';
import type { Notification } from '../../store/subscriptions/types';
import { notificationMessage } from '../../utils/notificationMessage';
import { statusLabel } from '../../utils/statusLabel';

interface NotificationTextProps {
  notification: Notification;
}

export function NotificationText({ notification }: NotificationTextProps) {
  switch (notification.type) {
    case 'status-change':
      return t('notificationCenter.statusChange', {
        from: statusLabel(notification.oldValue ?? ''),
        to: statusLabel(notification.newValue ?? ''),
      });
    case 'version-update':
      return t('notificationCenter.versionUpdate', {
        from: notification.oldValue ?? '',
        to: notification.newValue ?? '',
      });
    case 'app-update':
      return t('notificationCenter.appUpdate', {
        version: notification.newValue ?? '',
      });
    case 'progress-change':
      return notification.progress
        ? t('notificationCenter.progressChange', {
            kind: t(`translationProgress.${notification.progress.kind}`),
            to: notification.progress.to,
          })
        : (notification.newValue ?? null);
    case 'team-new-game':
      return (
        <Trans
          i18nKey="notificationCenter.teamNewGame"
          components={{
            team: <span className="text-yellow-400">{notification.teamName}</span>,
          }}
        />
      );
    case 'team-status-change':
      return (
        <Trans
          i18nKey="notificationCenter.teamStatusChange"
          components={{
            team: <span className="text-cyan-400">{notification.teamName}</span>,
            status: <>{statusLabel(notification.newValue ?? '')}</>,
          }}
        />
      );
    case 'feedback-reply':
      return (
        <>
          <span className="text-color-main">{t('notificationCenter.feedbackReply')}</span>{' '}
          {notificationMessage(notification)}
        </>
      );
    case 'review-rejected':
      return (
        <>
          <span className="text-red-400">{t('notificationCenter.reviewRejected')}</span>{' '}
          {notificationMessage(notification)}
        </>
      );
    case 'first-favorite':
      return t('notificationMessage.firstFavorite');
    case 'review-published':
      return t('notificationMessage.reviewPublished');
  }
}
