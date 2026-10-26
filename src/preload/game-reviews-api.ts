import { ipcRenderer } from 'electron';
import type { GameReviewsAPI } from '../shared/game-reviews-api-types';

export const gameReviewsAPI: GameReviewsAPI = {
  fetchGameReviews: (input) => ipcRenderer.invoke('reviews:list', input),
  replyToReview: (input) => ipcRenderer.invoke('reviews:reply', input),
  editReviewEntry: (input) => ipcRenderer.invoke('reviews:edit', input),
  getReviewAuthor: () => ipcRenderer.invoke('reviews:author'),
  spinReviewNickname: (input) => ipcRenderer.invoke('reviews:spin', input),
  claimReviewNickname: (input) => ipcRenderer.invoke('reviews:claim', input),
  submitFeedback: (input) => ipcRenderer.invoke('reviews:submit-feedback', input),
  getFeedbackUploadUrls: (input) => ipcRenderer.invoke('reviews:upload-urls', input),
};
