import { ipcMain } from 'electron';
import type {
  FeedbackUploadUrlsInput,
  GameReviewsListInput,
  NicknameClaimInput,
  NicknameSpinInput,
  ReviewEditInput,
  ReviewReplyInput,
  SubmitFeedbackInput,
  TurnstileAction,
} from '../../shared/game-reviews-api-types';
import { fetchGameReviews } from '../db/game-reviews-api';
import { editReviewEntry, replyToReview } from '../db/review-actions-api';
import {
  claimReviewNickname,
  getReviewAuthor,
  spinReviewNickname,
} from '../db/review-author-api';
import { getFeedbackUploadUrls, submitFeedback } from '../db/submit-feedback-api';
import { syncReviewEvents } from '../review-events';
import { prefetchCaptchaToken } from '../turnstile/tokens';

export function setupGameReviewsHandlers(): void {
  ipcMain.handle('reviews:list', (_, input: GameReviewsListInput) =>
    fetchGameReviews(input)
  );
  ipcMain.handle('reviews:reply', (_, input: ReviewReplyInput) => replyToReview(input));
  ipcMain.handle('reviews:edit', (_, input: ReviewEditInput) => editReviewEntry(input));
  ipcMain.handle('reviews:author', () => getReviewAuthor());
  ipcMain.handle('reviews:spin', (_, input: NicknameSpinInput) =>
    spinReviewNickname(input)
  );
  ipcMain.handle('reviews:claim', (_, input: NicknameClaimInput) =>
    claimReviewNickname(input)
  );
  ipcMain.handle('reviews:submit-feedback', (_, input: SubmitFeedbackInput) =>
    submitFeedback(input)
  );
  ipcMain.handle('reviews:upload-urls', (_, input: FeedbackUploadUrlsInput) =>
    getFeedbackUploadUrls(input)
  );
  ipcMain.handle('reviews:sync-events', () => syncReviewEvents());
  ipcMain.on('reviews:prefetch-captcha', (_, action: TurnstileAction) =>
    prefetchCaptchaToken(action)
  );
}
