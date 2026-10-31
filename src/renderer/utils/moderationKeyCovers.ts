import type { ReviewEvent } from '@/shared/game-reviews-types';

// Reads the key reviewModerationKey writes: a claimed verdict covers every event of its entry that is not newer, its repeats included
export function moderationKeyCovers(key: string, { entryId, at }: ReviewEvent): boolean {
  return (
    key.startsWith(`${entryId}:`) &&
    Number(key.slice(key.lastIndexOf(':') + 1)) >= Date.parse(at)
  );
}
