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

// The answer to the viewer's own write or post is still coming, or showed this very verdict
function isAnswered(
  queryClient: QueryClient,
  { gameId, entryId }: ReviewEvent,
  verdict: ModerationVerdict
): boolean {
  const write = findReviewWrite(queryClient, gameId, entryId);
  if (write) {
    return write.state.status === 'pending' || write.state.data?.verdict === verdict;
  }
  const post = findFeedbackPost(queryClient, entryId)?.state;
  return (
    post?.status === 'pending' ||
    (post?.data?.ok === true && post.data.outcome === verdict)
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
