import type { GameReview } from '@/shared/game-reviews-types';

// A clock behind the server's would date a new reply before the ones it follows
export function nextReplyTime(thread: GameReview, now: number): string {
  const latest = Math.max(
    ...[thread, ...thread.replies].map((item) => Date.parse(item.createdAt))
  );
  return new Date(Math.max(now, latest + 1)).toISOString();
}
