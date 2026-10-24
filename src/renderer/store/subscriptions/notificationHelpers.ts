import { t } from '@/shared/i18n/i18n';
import { playNotificationSound } from '../../utils/notificationSounds';
import { useSettingsStore } from '../useSettingsStore';
import type { Notification, ToastNotification } from './types';

const TOAST_DURATION = 8000; // 8 seconds

/**
 * Play notification sound if enabled in settings
 */
export function playNotificationSoundIfEnabled(type: ToastNotification['type']): void {
  const { notificationSoundsEnabled } = useSettingsStore.getState();
  if (notificationSoundsEnabled) {
    playNotificationSound(type);
  }
}

/**
 * Generate notification message based on type
 */
export function getNotificationMessage(
  notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
): string {
  switch (notification.type) {
    case 'status-change':
      return t('notificationMessage.statusChange', {
        status: notification.newValue ?? '',
      });
    case 'version-update':
      return t('notifications.versionAvailable', {
        version: notification.newValue ?? '',
      });
    case 'app-update':
      return t('notifications.versionAvailable', {
        version: notification.newValue ?? '',
      });
    case 'progress-change':
      return t('notificationMessage.progressChange', {
        progress: notification.newValue ?? '',
      });
    case 'team-new-game':
      return t('notifications.teamNewGame', { team: notification.teamName ?? '' });
    case 'team-status-change':
      return t('notifications.teamStatusChange', {
        team: notification.teamName ?? '',
        status: notification.newValue ?? '',
      });
    case 'first-favorite':
      return t('notificationMessage.firstFavorite');
    case 'feedback-reply':
      return notification.message
        ? `${notification.gameName}: ${notification.message}`
        : t('notificationMessage.feedbackReply');
    default:
      return t('notificationMessage.fallback');
  }
}

/**
 * Create a notification object
 */
export function createNotification(
  params: Omit<Notification, 'id' | 'timestamp' | 'read'> & { idPrefix?: string }
): Notification {
  const { idPrefix = params.gameId, ...rest } = params;
  return {
    ...rest,
    id: `${idPrefix}-${Date.now()}`,
    timestamp: Date.now(),
    read: false,
  };
}

/**
 * Create a toast notification from a notification
 */
export function createToast(
  notification: Notification,
  message: string
): ToastNotification {
  return {
    id: notification.id,
    type: notification.type,
    gameId: notification.gameId,
    gameName: notification.gameName,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Show system notification if window is hidden (in tray)
 */
export async function showSystemNotificationIfHidden(
  title: string,
  body: string,
  gameId?: string
): Promise<void> {
  if (
    !window.windowControls?.isVisible ||
    !window.windowControls?.showSystemNotification
  ) {
    return;
  }

  try {
    const isVisible = await window.windowControls.isVisible();
    if (!isVisible) {
      await window.windowControls.showSystemNotification({ title, body, gameId });
    }
  } catch (error) {
    console.error('[Notification] Failed to show system notification:', error);
  }
}

/**
 * Schedule toast dismissal
 */
export function scheduleToastDismissal(
  toastId: string,
  dismissFn: (id: string) => void,
  duration: number = TOAST_DURATION
): void {
  setTimeout(() => {
    dismissFn(toastId);
  }, duration);
}

/**
 * Track subscription via IPC (main process handles the API call)
 */
export async function trackSubscription(
  gameId: string,
  action: 'subscribe' | 'unsubscribe'
): Promise<void> {
  try {
    await window.electronAPI?.trackSubscription(gameId, action);
  } catch (error) {
    console.error('[Subscription] Failed to track subscription:', error);
  }
}
