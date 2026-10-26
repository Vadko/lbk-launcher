import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type { GameReviewEntry, GameReviewOutcome } from '@/shared/game-reviews-types';
import type { EntryUpdate } from './reviewCache';

type EntrySnapshot = Pick<
  GameReviewEntry,
  'text' | 'pendingText' | 'moderation' | 'editedAt'
>;

export const markChecking: EntryUpdate = (entry) => ({
  ...entry,
  isChecking: true,
  failure: undefined,
});

export function markFailed(failure: ReviewFailure): EntryUpdate {
  return (entry) => ({ ...entry, isChecking: false, failure });
}

export function afterReply(outcome: GameReviewOutcome): EntryUpdate {
  return (entry) =>
    outcome === 'removed' ? null : { ...entry, moderation: outcome, isChecking: false };
}

// A published entry keeps showing its edit beside the old text until moderation answers
export function withEdit(text: string): EntryUpdate {
  return (entry) => ({
    ...entry,
    isChecking: true,
    ...(entry.moderation === 'published' ? { pendingText: text } : { text }),
  });
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
      return { ...entry, pendingText: text, isChecking: false };
    }
    return {
      ...entry,
      text,
      pendingText: null,
      moderation: outcome,
      editedAt: entry.moderation === 'published' ? now : entry.editedAt,
      isChecking: false,
    };
  };
}

export function restored({
  text,
  pendingText,
  moderation,
  editedAt,
}: EntrySnapshot): EntryUpdate {
  return (entry) => ({
    ...entry,
    text,
    pendingText,
    moderation,
    editedAt,
    isChecking: false,
    failure: undefined,
  });
}
