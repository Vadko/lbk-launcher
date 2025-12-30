import type { Notification, ToastNotification } from './types';
import { playNotificationSound } from '../../utils/notificationSounds';
import { useSettingsStore } from '../useSettingsStore';

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
      return `Стан змінено на "${notification.newValue}"`;
    case 'version-update':
      return `Доступна версія ${notification.newValue}`;
    case 'app-update':
      return `Доступна версія ${notification.newValue}`;
    case 'progress-change':
      return `Прогрес оновлено: ${notification.newValue}`;
    case 'team-new-game':
      return `Нова локалізація від ${notification.teamName}`;
    case 'team-status-change':
      return `${notification.teamName}: стан змінено на "${notification.newValue}"`;
    default:
      return 'Нове сповіщення';
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
