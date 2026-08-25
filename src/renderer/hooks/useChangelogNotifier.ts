import { useEffect } from 'react';
import { CHANGELOG } from '../store/useChangelogStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';

/**
 * Surfaces a one-time toast/notification when changelog.json ships a version
 * newer than the last one the user has seen. Reuses the existing toast +
 * notification-history pipeline instead of a bespoke UI — dedup works the
 * same way as the app-update flow: check the persisted notifications list.
 */
export function useChangelogNotifier() {
  useEffect(() => {
    const latest = CHANGELOG[0];
    if (!latest) {
      return;
    }

    const { notifications, addChangelogNotification } = useSubscriptionsStore.getState();
    const hasExisting = notifications.some(
      (n) => n.type === 'changelog' && n.newValue === latest.version
    );

    if (!hasExisting) {
      addChangelogNotification(latest.version, latest.title);
    }
  }, []);
}
