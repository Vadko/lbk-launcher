import type { GameReviewEntry } from '@/shared/game-reviews-types';

export function isAwaitingModeration(entry: GameReviewEntry): boolean {
  return entry.moderation === 'pending' || entry.pendingText !== null;
}
