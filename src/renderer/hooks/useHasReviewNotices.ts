import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { isGameReviewNotice } from '../utils/isGameReviewNotice';

export function useHasReviewNotices(gameId: string): boolean {
  return useSubscriptionsStore((state) =>
    state.notifications.some(
      (notification) => !notification.read && isGameReviewNotice(notification, gameId)
    )
  );
}
