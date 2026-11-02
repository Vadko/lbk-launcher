import type { GameReviewAuthor, ReviewEvent } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';

// Staff replies come unnamed, and an author's falls back to the role when the game has no team
const AUTHOR_NAMES: Record<
  GameReviewAuthor['role'],
  (name: string | null) => string | null
> = {
  moderator: () => t('gameReviews.moderator'),
  author: (name) => name ?? t('gameReviews.translationAuthor'),
  player: (name) => name,
};

export function reviewReplyText({
  authorRole,
  authorName,
  message,
}: ReviewEvent): string {
  const text = message ?? t('notificationMessage.feedbackReply');
  const name = AUTHOR_NAMES[authorRole](authorName);
  return name ? t('notifications.replyBy', { name, message: text }) : text;
}
