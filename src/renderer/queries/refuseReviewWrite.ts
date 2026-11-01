import type { QueryClient } from '@tanstack/react-query';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { type EntryUpdate, type ReviewPages, updateEntry } from '../utils/reviewCache';
import { withoutPendingEdit } from '../utils/reviewEntryUpdates';
import type { ReviewRefusalReason } from '../utils/reviewRefusalMessage';
import { type RefusalNotice, reviewRefusalNotice } from '../utils/reviewRefusalNotice';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';

// gone: the entry leaves the list; refused: the server stored nothing, so the cache already shows its state; rolledBack: moderation refused a stored edit
type ReviewRefusalEffect = 'gone' | 'refused' | 'rolledBack';

export interface ReviewRefusal {
  gameId: string;
  gameName: string;
  // The thread the entry belongs to, when the caller knows it, so the notice can link there
  feedbackId?: string;
  entryId: string;
  // The answered send, whose write goes; a moderation event names none, so a write that failed to send stays
  attempt?: number;
  effect: ReviewRefusalEffect;
  reason: ReviewRefusalReason;
}

type Release = (gameId: string, entryId: string, answered: boolean) => void;

const rollBack: Release = (gameId, entryId, answered) =>
  useReviewOverlayStore.getState().rollBack(gameId, entryId, answered);

const EFFECTS: Record<ReviewRefusalEffect, { update: EntryUpdate; release: Release }> = {
  // A gone entry takes any write on it along
  gone: {
    update: () => null,
    release: (gameId, entryId) => useReviewOverlayStore.getState().drop(gameId, entryId),
  },
  refused: { update: (entry) => entry, release: rollBack },
  rolledBack: { update: withoutPendingEdit, release: rollBack },
};

const toastOnly = (notice: RefusalNotice) =>
  useSubscriptionsStore.getState().showToast(notice);

// The server's last word on the viewer's write, whether its answer or a later moderation verdict brings it
export function refuseReviewWrite(
  queryClient: QueryClient,
  { attempt, effect, ...refused }: ReviewRefusal,
  // A refusal answered to a request only shows a toast; one that should stay in the list passes its own
  announce: (notice: RefusalNotice) => void = toastOnly
): void {
  const { gameId, entryId } = refused;
  const { update, release } = EFFECTS[effect];
  const queryKey = gameReviewsQueryKey(gameId);
  const data = queryClient.getQueryData<ReviewPages>(queryKey);
  const next = data && updateEntry(data, entryId, update);
  // A write that never reached the cache leaves it alone, so the pages are not marked fresh for nothing
  if (next !== data) {
    queryClient.setQueryData(queryKey, next);
  }
  release(gameId, entryId, attempt !== undefined);
  announce(reviewRefusalNotice(refused));
}
