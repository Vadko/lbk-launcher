import type { GameReviewsAPI } from '../shared/game-reviews-api-types';
import { invoke, listen, send } from './ipc';

export const gameReviewsAPI: GameReviewsAPI = {
  fetchGameReviews: invoke('reviews:list'),
  replyToReview: invoke('reviews:reply'),
  editReviewEntry: invoke('reviews:edit'),
  getReviewAuthor: invoke('reviews:author'),
  spinReviewNickname: invoke('reviews:spin'),
  claimReviewNickname: invoke('reviews:claim'),
  submitFeedback: invoke('reviews:submit-feedback'),
  getFeedbackUploadUrls: invoke('reviews:upload-urls'),
  prefetchCaptcha: send('reviews:prefetch-captcha'),
  onReviewEvents: listen('review-events'),
  syncReviewEvents: invoke('reviews:sync-events'),
};
