import { ipcMain } from 'electron';
import { syncFeedbackReplies } from '../feedback-replies';

/** Renderer-triggered catch-up of feedback replies missed while offline. */
export function setupFeedbackReplyHandlers(): void {
  ipcMain.handle('feedback-replies:sync', () => syncFeedbackReplies());
}
