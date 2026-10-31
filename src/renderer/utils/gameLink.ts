import type { GameLinkTarget } from '@/shared/game-link-target';

export const REVIEWS_TAB = 'reviews';

// Notices stored before review links existed carry no ids and open the game page
export function gameLink({
  gameId,
  feedbackId,
  entryId = feedbackId,
}: GameLinkTarget): string {
  const path = `/game/${gameId}`;
  if (!feedbackId || !entryId) {
    return path;
  }
  const search = new URLSearchParams({
    tab: REVIEWS_TAB,
    thread: feedbackId,
    entry: entryId,
  });
  return `${path}?${search}`;
}
