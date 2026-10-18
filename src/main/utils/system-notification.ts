import { Notification } from 'electron';
import { isMacOS } from '@/main/utils/platform';
import { getIcon } from '@/main/utils/theme';
import { showMainWindow } from '@/main/window';

// A click brings the window back first; false when the platform shows none.
export function showSystemNotification(options: {
  title: string;
  body: string;
  onClick?: () => void;
}): boolean {
  if (!Notification.isSupported()) {
    console.log('[Notification] System notifications not supported');
    return false;
  }
  try {
    const notification = new Notification({
      title: options.title,
      body: options.body,
      // macOS uses the app icon automatically.
      icon: isMacOS() ? undefined : getIcon('notification'),
      silent: false,
    });
    notification.on('failed', (_event, error) => {
      console.warn('[Notification] Failed to show notification:', error);
    });
    notification.on('click', () => {
      showMainWindow();
      options.onClick?.();
    });
    notification.show();
    return true;
  } catch (error) {
    console.warn('[Notification] Failed to show notification:', error);
    return false;
  }
}
