import type { ReviewEvent } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';
import { reviewAuthorName } from './reviewAuthorName';

export function reviewReplyText({
  authorRole,
  authorName,
  message,
}: Pick<ReviewEvent, 'authorRole' | 'authorName' | 'message'>): string {
  const text = message ?? t('notificationMessage.feedbackReply');
  const name = reviewAuthorName(authorRole, authorName);
  return name ? t('notifications.replyBy', { name, message: text }) : text;
}
