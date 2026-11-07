import type { GameReviewAuthor } from '@/shared/game-reviews-types';
import { t } from '@/shared/i18n/i18n';

// Staff come unnamed, and an author falls back to the role when the game has no team; null for a player without a nickname
const AUTHOR_NAMES: Record<
  GameReviewAuthor['role'],
  (name: string | null) => string | null
> = {
  moderator: () => t('gameReviews.moderator'),
  author: (name) => name ?? t('gameReviews.translationAuthor'),
  player: (name) => name,
};

export function reviewAuthorName(
  role: GameReviewAuthor['role'],
  name: string | null
): string | null {
  return AUTHOR_NAMES[role](name);
}
