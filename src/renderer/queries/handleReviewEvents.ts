import type { QueryClient } from '@tanstack/react-query';
import type { GameReviewEntry, ReviewEvent } from '@/shared/game-reviews-types';
import type { Notification } from '../store/subscriptions/types';
import { useReviewOverlayStore } from '../store/useReviewOverlayStore';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { isAwaitingModeration } from '../utils/isAwaitingModeration';
import { type ModerationVerdict, moderationVerdict } from '../utils/moderationVerdict';
import { publishedUpdate } from '../utils/publishedUpdate';
import { findEntry, type ReviewPages, updateEntry } from '../utils/reviewCache';
import { reviewModerationKey } from '../utils/reviewModerationKey';
import { reviewRefusalNotice } from '../utils/reviewRefusalNotice';
import { gameReviewsQueryKey } from './gameReviewsQueryKey';
import { refreshGameReviews } from './refreshGameReviews';
import { refuseReviewWrite } from './refuseReviewWrite';

interface Batch {
  queryClient: QueryClient;
  live: boolean;
  // Games whose pages must come from the server again, each refreshed once when the batch ends
  stale: Set<string>;
}

interface Verdict extends Batch {
  event: ReviewEvent;
  // A write on the entry was answered or failed meanwhile, so the event may predate what the cache shows
  waited: boolean;
}

const subscriptions = () => useSubscriptionsStore.getState();
const overlay = () => useReviewOverlayStore.getState();

// Two verdicts of one catch-up can land in the same millisecond, and the list keys notices by id
const notify = (
  { event, live }: Verdict,
  notice: Omit<Notification, 'id' | 'timestamp' | 'read'>
) =>
  subscriptions().addNotification(
    { ...notice, idPrefix: `review-${reviewModerationKey(event)}` },
    live
  );

const refetch = ({ stale, event }: Verdict) => void stale.add(event.gameId);

// A page already on its way predates the verdict, so it is fetched again rather than let undo the patch
function patchFresh(verdict: Verdict, patch: () => void): void {
  const { queryClient, event } = verdict;
  const wasFetching =
    queryClient.isFetching({ queryKey: gameReviewsQueryKey(event.gameId) }) > 0;
  patch();
  if (wasFetching) {
    refetch(verdict);
  }
}

// News unless the entry was published and showed this text already; a missing one was removed or never seen here
const isNewlyPublished = (
  { message }: ReviewEvent,
  cached: GameReviewEntry | undefined
) =>
  !cached ||
  isAwaitingModeration(cached) ||
  (message !== null && message !== cached.text);

function remove(verdict: Verdict): void {
  const { queryClient, event } = verdict;
  const { gameId, gameName, feedbackId, entryId } = event;
  patchFresh(verdict, () =>
    refuseReviewWrite(
      queryClient,
      { gameId, gameName, feedbackId, entryId, effect: 'gone', reason: 'removed' },
      (notice) => notify(verdict, notice)
    )
  );
}

function rollBack(verdict: Verdict): void {
  const { queryClient, event } = verdict;
  const { gameId, gameName, feedbackId, entryId } = event;
  const refusal = {
    gameId,
    gameName,
    feedbackId,
    entryId,
    reason: 'edit_rejected',
  } as const;
  // The newer write's own answer is in the cache now, and only the server knows which came last
  if (verdict.waited) {
    refetch(verdict);
    notify(verdict, reviewRefusalNotice(refusal));
    return;
  }
  patchFresh(verdict, () =>
    refuseReviewWrite(queryClient, { ...refusal, effect: 'rolledBack' }, (notice) =>
      notify(verdict, notice)
    )
  );
}

function publish(verdict: Verdict): void {
  const { queryClient, event } = verdict;
  const { gameId, gameName, feedbackId, entryId } = event;
  const queryKey = gameReviewsQueryKey(gameId);
  const data = queryClient.getQueryData<ReviewPages>(queryKey);
  const cached = findEntry(data, entryId)?.entry;
  // An entry the cache lacks comes back with the server's pages: it was removed, or a page read before the publish is loading
  if (verdict.waited || !data || !cached) {
    refetch(verdict);
  } else {
    const next = updateEntry(data, entryId, publishedUpdate(event));
    if (next !== data) {
      patchFresh(verdict, () => queryClient.setQueryData(queryKey, next));
    }
  }
  if (isNewlyPublished(event, cached)) {
    notify(verdict, { type: 'review-published', gameId, gameName, feedbackId, entryId });
  }
}

const VERDICTS: Record<ModerationVerdict, (verdict: Verdict) => void> = {
  removed: remove,
  rolledBack: rollBack,
  published: publish,
  // A held edit is not news: its own answer said so already
  pending: () => undefined,
};

const isAwaitingAnswer = (
  { games, posting }: ReturnType<typeof overlay>,
  { gameId, entryId }: ReviewEvent
) => games.get(gameId)?.get(entryId)?.state === 'checking' || posting.has(entryId);

// Runs once the entry's write or post has its answer, or failed, or was discarded
function afterAnswer(event: ReviewEvent, run: () => void): void {
  const unsubscribe = useReviewOverlayStore.subscribe((state) => {
    if (!isAwaitingAnswer(state, event)) {
      unsubscribe();
      run();
    }
  });
}

function inBatch(
  queryClient: QueryClient,
  live: boolean,
  run: (batch: Batch) => void
): void {
  const batch: Batch = { queryClient, live, stale: new Set() };
  run(batch);
  for (const gameId of batch.stale) {
    refreshGameReviews(queryClient, gameId);
  }
}

function applyModeration(batch: Batch, event: ReviewEvent, waited = false): void {
  // The answer may still be on its way, and applied after this event it would undo it
  if (isAwaitingAnswer(overlay(), event)) {
    const { queryClient, live } = batch;
    afterAnswer(event, () =>
      inBatch(queryClient, live, (later) => applyModeration(later, event, true))
    );
    return;
  }
  if (!subscriptions().claimModerationEvent(event)) {
    return;
  }
  const verdict = moderationVerdict(event);
  // The answer to the viewer's own write showed this verdict and wrote it into the cache
  if (overlay().takeShown(event.entryId) === verdict) {
    return;
  }
  VERDICTS[verdict]({ ...batch, event, waited });
}

// One batch per IPC message: a catch-up page or a live event
export function handleReviewEvents(
  queryClient: QueryClient,
  events: ReviewEvent[],
  live: boolean
): void {
  inBatch(queryClient, live, (batch) => {
    for (const event of events) {
      if (event.kind === 'moderation') {
        applyModeration(batch, event);
      } else if (subscriptions().addReplyNotification(event, live)) {
        // The event carries no avatar seed, so the thread comes from the server
        batch.stale.add(event.gameId);
      }
    }
  });
}
