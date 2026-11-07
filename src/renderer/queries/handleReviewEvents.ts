import type { QueryClient } from '@tanstack/react-query';
import type { ReviewEvent } from '@/shared/game-reviews-types';
import type { Notification } from '../store/subscriptions/types';
import { useSubscriptionsStore } from '../store/useSubscriptionsStore';
import { type ModerationVerdict, moderationVerdict } from '../utils/moderationVerdict';
import { reviewModerationKey } from '../utils/reviewModerationKey';
import { reviewRefusalNotice } from '../utils/reviewRefusalNotice';
import { findFeedbackPost, findReviewWrite } from './entryWrites';
import { refreshGameReviews } from './refreshGameReviews';

type Notice = Omit<Notification, 'id' | 'timestamp' | 'read'>;

const NOTICES: Record<ModerationVerdict, (event: ReviewEvent) => Notice | null> = {
  removed: ({ gameId, gameName, feedbackId, entryId }) =>
    reviewRefusalNotice({ gameId, gameName, feedbackId, entryId, reason: 'removed' }),
  rolledBack: ({ gameId, gameName, feedbackId, entryId }) =>
    reviewRefusalNotice({
      gameId,
      gameName,
      feedbackId,
      entryId,
      reason: 'edit_rejected',
    }),
  published: ({ gameId, gameName, feedbackId, entryId }) => ({
    type: 'review-published',
    gameId,
    gameName,
    feedbackId,
    entryId,
  }),
  // A held edit is not news: its own answer said so already
  pending: () => null,
};

// at is the server's clock and answeredAt this machine's, so a clock that lags still matches the answer's own event
const CLOCK_SKEW_MS = 60_000;

// The answer is still coming, or showed this verdict no earlier than the event: an older one predates a restore after a removal
function isAnswered(
  queryClient: QueryClient,
  { gameId, entryId, at }: ReviewEvent,
  verdict: ModerationVerdict
): boolean {
  const shows = (shown: string | null, answeredAt: number) =>
    shown === verdict && Date.parse(at) <= answeredAt + CLOCK_SKEW_MS;
  const write = findReviewWrite(queryClient, gameId, entryId)?.state;
  if (write) {
    return (
      write.status === 'pending' ||
      (write.data !== undefined && shows(write.data.verdict, write.data.answeredAt))
    );
  }
  const post = findFeedbackPost(queryClient, entryId)?.state;
  return (
    post?.status === 'pending' ||
    (post?.data?.ok === true && shows(post.data.outcome, post.data.answeredAt))
  );
}

// One batch per IPC message: a catch-up page or a live event
export function handleReviewEvents(
  queryClient: QueryClient,
  events: ReviewEvent[],
  live: boolean
): void {
  const subscriptions = useSubscriptionsStore.getState();
  const stale = new Set<string>();
  for (const event of events) {
    if (event.kind === 'reply') {
      if (subscriptions.addReplyNotification(event, live)) {
        stale.add(event.gameId);
      }
      continue;
    }
    const verdict = moderationVerdict(event);
    if (
      !subscriptions.claimModerationEvent(event) ||
      isAnswered(queryClient, event, verdict)
    ) {
      continue;
    }
    const notice = NOTICES[verdict](event);
    if (notice) {
      // Two verdicts of one catch-up can land in the same millisecond, and the list keys notices by id
      subscriptions.addNotification(
        { ...notice, idPrefix: `review-${reviewModerationKey(event)}` },
        live
      );
    }
    stale.add(event.gameId);
  }
  for (const gameId of stale) {
    refreshGameReviews(queryClient, gameId);
  }
}
