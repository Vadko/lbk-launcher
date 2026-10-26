import type {
  FeedbackUploadUrl,
  FeedbackUploadUrlsInput,
  ReviewEditInput,
  ReviewFailure,
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
  SubmitFeedbackInput,
} from '@/shared/game-reviews-api-types';
import type { GameReviewsPage } from '@/shared/game-reviews-types';

// A rejected IPC call means the bridge itself broke, which a resend may outlive
const BRIDGE_FAILURE: ReviewFailure = { code: 'unreachable', kind: 'retry' };

async function settled<T>(request: Promise<ReviewResult<T>>): Promise<ReviewResult<T>> {
  try {
    return await request;
  } catch (error) {
    console.error('[GameReviews] IPC call failed:', error);
    return { ok: false, failure: BRIDGE_FAILURE };
  }
}

// React Query needs a throw to keep the cached pages and show the retry
export async function fetchReviewsPage(
  gameId: string,
  cursor: string | null
): Promise<GameReviewsPage> {
  const result = await window.electronAPI.fetchGameReviews({ gameId, cursor });
  if (!result.ok) {
    throw new Error(`Reviews list failed: ${result.failure.code}`);
  }
  return result.data;
}

export function sendReviewReply(
  input: ReviewReplyInput
): Promise<ReviewResult<ReviewWriteResult>> {
  return settled(window.electronAPI.replyToReview(input));
}

export function sendReviewEdit(
  input: ReviewEditInput
): Promise<ReviewResult<ReviewWriteResult>> {
  return settled(window.electronAPI.editReviewEntry(input));
}

export function sendFeedback(
  input: SubmitFeedbackInput
): Promise<ReviewResult<ReviewWriteResult>> {
  return settled(window.electronAPI.submitFeedback(input));
}

export function requestFeedbackUploadUrls(
  input: FeedbackUploadUrlsInput
): Promise<ReviewResult<FeedbackUploadUrl[]>> {
  return settled(window.electronAPI.getFeedbackUploadUrls(input));
}
