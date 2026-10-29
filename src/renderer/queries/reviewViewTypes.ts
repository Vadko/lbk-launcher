import type { InfiniteData } from '@tanstack/react-query';
import type { ReviewFailure } from '@/shared/game-reviews-api-types';
import type {
  GameReview,
  GameReviewRemovedReply,
  GameReviewReply,
  GameReviewsPage,
} from '@/shared/game-reviews-types';

// The viewer's own reply or edit that the server has not taken yet
export interface ReviewWriteStatus {
  write?: 'reply' | 'edit';
  isChecking?: boolean;
  // Set once the write failed; a resend goes out with the same id
  failure?: ReviewFailure;
  // The server refused the viewer's edit, so the badge leaves without confirming
  isRolledBack?: boolean;
}

export type ReviewReplyView = GameReviewReply & ReviewWriteStatus;

export type ReviewThreadReplyView = ReviewReplyView | GameReviewRemovedReply;

export interface ReviewThreadView extends GameReview, ReviewWriteStatus {
  replies: ReviewThreadReplyView[];
}

interface ReviewViewPage extends GameReviewsPage {
  items: ReviewThreadView[];
}

export type ReviewViewPages = InfiniteData<ReviewViewPage, string | null>;
