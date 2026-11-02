import type { GameReviewOutcome } from '@/shared/game-reviews-types';
import type { FeedbackType } from '@/shared/types';

export type FeedbackSentScreen = 'private' | GameReviewOutcome;

type SentText =
  | 'feedbackModal.thanks'
  | 'feedbackModal.thanks_error'
  | 'feedbackModal.sent'
  | 'feedbackModal.sent_error'
  | 'feedbackModal.published'
  | 'feedbackModal.publishedHint'
  | 'feedbackModal.onModeration'
  | 'gameReviews.hint.moderation'
  | 'feedbackModal.removedByModeration'
  | 'feedbackModal.removedHint';

interface FeedbackSentView {
  screen: FeedbackSentScreen;
  title: SentText;
  text: SentText;
  closeAfterMs: number;
}

const QUICK_CLOSE_MS = 2000;
// Long enough to read why the post is not visible yet, or not at all
const SLOW_CLOSE_MS = 5000;

type View = Omit<FeedbackSentView, 'screen'>;

const PRIVATE_VIEWS: Record<FeedbackType, View> = {
  feedback: {
    title: 'feedbackModal.thanks',
    text: 'feedbackModal.sent',
    closeAfterMs: QUICK_CLOSE_MS,
  },
  error: {
    title: 'feedbackModal.thanks_error',
    text: 'feedbackModal.sent_error',
    closeAfterMs: QUICK_CLOSE_MS,
  },
};

const PUBLIC_VIEWS: Record<GameReviewOutcome, View> = {
  published: {
    title: 'feedbackModal.published',
    text: 'feedbackModal.publishedHint',
    closeAfterMs: QUICK_CLOSE_MS,
  },
  pending: {
    title: 'feedbackModal.onModeration',
    text: 'gameReviews.hint.moderation',
    closeAfterMs: SLOW_CLOSE_MS,
  },
  removed: {
    title: 'feedbackModal.removedByModeration',
    text: 'feedbackModal.removedHint',
    closeAfterMs: SLOW_CLOSE_MS,
  },
};

// A private post answers published as well, so only the choice to publish tells the two apart
export function feedbackSentView(
  type: FeedbackType,
  allowPublish: boolean,
  outcome: GameReviewOutcome
): FeedbackSentView {
  return allowPublish
    ? { screen: outcome, ...PUBLIC_VIEWS[outcome] }
    : { screen: 'private', ...PRIVATE_VIEWS[type] };
}
