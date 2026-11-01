import type { ReviewEvent } from '@/shared/game-reviews-types';

// at is the verdict's own time, so a second rejected edit with the same editedAt still counts; parsing it evens out how the offset was written
export function reviewModerationKey({ entryId, at }: ReviewEvent): string {
  return `${entryId}:${Date.parse(at)}`;
}
