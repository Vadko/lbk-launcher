import type { Notification } from '../store/subscriptions/types';

const REVIEW_NOTICES: Partial<Record<Notification['type'], true>> = {
  'feedback-reply': true,
  'review-published': true,
};

// A notice about the game's reviews that its reviews tab shows; a refusal's reason lives only in its notice
export const isGameReviewNotice = (notification: Notification, gameId: string) =>
  notification.gameId === gameId && (REVIEW_NOTICES[notification.type] ?? false);
