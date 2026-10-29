import type { GameReviewOutcome } from '@/shared/game-reviews-types';
import { appendReply, findEntry, type ReviewPages, updateEntry } from './reviewCache';
import { afterEdit } from './reviewEntryUpdates';
import type { ReviewWriteDraft } from './reviewOverlay';

// The server took the write: the cached pages get it before the overlay lets go of it
export function handOver(
  data: ReviewPages,
  entryId: string,
  draft: ReviewWriteDraft,
  outcome: GameReviewOutcome,
  now: string
): ReviewPages {
  if (draft.kind === 'edit') {
    return updateEntry(data, entryId, afterEdit(outcome, draft.text, now));
  }
  // A refetch during moderation brought the reply as pending, so the answer's verdict goes onto that copy
  if (findEntry(data, entryId)) {
    return updateEntry(data, entryId, (entry) =>
      outcome === 'removed' ? null : { ...entry, moderation: outcome }
    );
  }
  return outcome === 'removed'
    ? data
    : appendReply(data, draft.reviewId, { ...draft.reply, moderation: outcome });
}
