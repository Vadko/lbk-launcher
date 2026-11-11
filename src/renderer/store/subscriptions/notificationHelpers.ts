import { D } from '@mobily/ts-belt';
import type { GameLinkTarget } from '@/shared/game-link-target';
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
export function createToast(notification: Notification): ToastNotification {
  return { ...D.deleteKeys(notification, ['read', 'sourceId']), timestamp: Date.now() };
}

/**
 * Show system notification if window is hidden (in tray)
 */
export async function showSystemNotificationIfHidden(
  title: string,
  body: string,
  link?: GameLinkTarget
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
      await window.windowControls.showSystemNotification({ title, body, target: link });
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
