import type {
  FeedbackUploadUrl,
  FeedbackUploadUrlsInput,
  NicknameClaimInput,
  NicknameSpin,
  NicknameSpinInput,
  ReviewAuthorState,
  ReviewEditInput,
  ReviewEditResult,
  ReviewReplyInput,
  ReviewResult,
  ReviewWriteResult,
  SubmitFeedbackInput,
  TurnstileAction,
} from '@/shared/game-reviews-api-types';
import type { GameReviewsPage, ReviewAuthorIdentity } from '@/shared/game-reviews-types';

// React Query needs a throw to keep the cached pages and show the retry
export async function fetchReviewsPage(
  gameId: string,
  cursor: string | null,
  focusId?: string
): Promise<GameReviewsPage> {
  const result = await window.electronAPI.fetchGameReviews({ gameId, cursor, focusId });
  if (!result.ok) {
    throw new Error(`Reviews list failed: ${result.failure.code}`);
  }
  return result.data;
}

export function sendReviewReply(
  input: ReviewReplyInput
): Promise<ReviewResult<ReviewWriteResult>> {
  return window.electronAPI.replyToReview(input);
}

export function sendReviewEdit(
  input: ReviewEditInput
): Promise<ReviewResult<ReviewEditResult>> {
  return window.electronAPI.editReviewEntry(input);
}

export function sendFeedback(
  input: SubmitFeedbackInput
): Promise<ReviewResult<ReviewWriteResult>> {
  return window.electronAPI.submitFeedback(input);
}

export function prefetchReviewCaptcha(action: TurnstileAction): void {
  window.electronAPI.prefetchCaptcha(action);
}

export function requestFeedbackUploadUrls(
  input: FeedbackUploadUrlsInput
): Promise<ReviewResult<FeedbackUploadUrl[]>> {
  return window.electronAPI.getFeedbackUploadUrls(input);
}

export function fetchReviewAuthor(): Promise<ReviewResult<ReviewAuthorState>> {
  return window.electronAPI.getReviewAuthor();
}

export function spinNickname(
  input: NicknameSpinInput
): Promise<ReviewResult<NicknameSpin>> {
  return window.electronAPI.spinReviewNickname(input);
}

export function claimNickname(
  input: NicknameClaimInput
): Promise<ReviewResult<ReviewAuthorIdentity>> {
  return window.electronAPI.claimReviewNickname(input);
}
