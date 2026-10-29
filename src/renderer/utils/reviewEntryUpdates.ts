import type { GameReviewEntry, GameReviewOutcome } from '@/shared/game-reviews-types';
import type { EntryUpdate } from './reviewCache';

// A published entry keeps showing its edit beside the old text until moderation answers
export function withEdit<T extends GameReviewEntry>(entry: T, text: string): T {
  return entry.moderation === 'published'
    ? { ...entry, pendingText: text }
    : { ...entry, text };
}

export function afterEdit(
  outcome: GameReviewOutcome,
  text: string,
  now: string
): EntryUpdate {
  return (entry) => {
    if (outcome === 'removed') {
      return null;
    }
    if (outcome === 'pending' && entry.moderation === 'published') {
      return { ...entry, pendingText: text };
    }
    return {
      ...entry,
      text,
      pendingText: null,
      moderation: outcome,
      editedAt: entry.moderation === 'published' ? now : entry.editedAt,
    };
  };
}

// A refused edit leaves the entry with the text everyone already sees
export const withoutPendingEdit: EntryUpdate = (entry) =>
  entry.pendingText === null ? entry : { ...entry, pendingText: null };
