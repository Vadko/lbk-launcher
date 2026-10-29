import type { QueryClient } from '@tanstack/react-query';
import type { ToastNotification } from '../store/subscriptions/types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { type EntryUpdate, type ReviewPages, updateEntry } from '../utils/reviewCache';
import { withoutPendingEdit } from '../utils/reviewEntryUpdates';
import {
  type ReviewRefusalReason,
  reviewRefusalMessage,
} from '../utils/reviewRefusalMessage';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';

// gone: the entry leaves the list; refused: the server stored nothing, so the cache already shows its state; rolledBack: moderation refused a stored edit
type ReviewRefusalEffect = 'gone' | 'refused' | 'rolledBack';

export interface ReviewRefusal {
  gameId: string;
  gameName: string;
  entryId: string;
  effect: ReviewRefusalEffect;
  reason: ReviewRefusalReason;
}

type RefusalNotice = Omit<ToastNotification, 'id' | 'timestamp'>;

const EFFECTS: Record<
  ReviewRefusalEffect,
  { update: EntryUpdate; release: (gameId: string, entryId: string) => void }
> = {
  gone: {
    update: () => null,
    release: (gameId, entryId) => useReviewOverlayStore.getState().drop(gameId, entryId),
  },
  refused: {
    update: (entry) => entry,
    release: (gameId, entryId) =>
      useReviewOverlayStore.getState().rollBack(gameId, entryId),
  },
  rolledBack: {
    update: withoutPendingEdit,
    release: (gameId, entryId) =>
      useReviewOverlayStore.getState().rollBack(gameId, entryId),
  },
};

const toastOnly = (notice: RefusalNotice) =>
  useSubscriptionsStore.getState().showToast(notice);

// The server's last word on the viewer's write, whether its answer or a later moderation verdict brings it
export function refuseReviewWrite(
  queryClient: QueryClient,
  { gameId, gameName, entryId, effect, reason }: ReviewRefusal,
  // A refusal answered to a request only shows a toast; one that should stay in the list passes its own
  announce: (notice: RefusalNotice) => void = toastOnly
): void {
  const { update, release } = EFFECTS[effect];
  const queryKey = gameReviewsQueryKey(gameId);
  const data = queryClient.getQueryData<ReviewPages>(queryKey);
  const next = data && updateEntry(data, entryId, update);
  // A write that never reached the cache leaves it alone, so the pages are not marked fresh for nothing
  if (next !== data) {
    queryClient.setQueryData(queryKey, next);
  }
  release(gameId, entryId);
  announce({
    type: 'review-rejected',
    gameId,
    gameName,
    message: reviewRefusalMessage(reason),
  });
}
