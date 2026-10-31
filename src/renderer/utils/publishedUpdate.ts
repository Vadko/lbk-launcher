import type { ReviewEvent } from '@/shared/game-reviews-types';
import type { EntryUpdate } from './reviewCache';

// An edit under moderation becomes the shown text; an entry already in that state stays the same object
export function publishedUpdate({ message, editedAt }: ReviewEvent): EntryUpdate {
  return (entry) => {
    const text = message ?? entry.pendingText ?? entry.text;
    const isSettled =
      entry.moderation === 'published' &&
      entry.pendingText === null &&
      entry.text === text &&
      entry.editedAt === editedAt;
    return isSettled
      ? entry
      : { ...entry, text, pendingText: null, moderation: 'published', editedAt };
  };
}
