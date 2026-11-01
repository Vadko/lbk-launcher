import type { ReviewEvent } from '@/shared/game-reviews-types';

export type ModerationVerdict = 'removed' | 'rolledBack' | 'published' | 'pending';

export function moderationVerdict({
  outcome,
  editRejected,
}: Pick<ReviewEvent, 'outcome' | 'editRejected'>): ModerationVerdict {
  if (outcome === 'removed') {
    return 'removed';
  }
  return editRejected ? 'rolledBack' : outcome;
}
