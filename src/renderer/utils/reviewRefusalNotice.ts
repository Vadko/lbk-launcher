import type { ToastNotification } from '../store/subscriptions/types';
import type { ReviewRefusalReason } from './reviewRefusalMessage';

export type RefusalNotice = Omit<ToastNotification, 'id' | 'timestamp'>;

interface RefusedEntry {
  gameId: string;
  gameName: string;
  feedbackId?: string;
  entryId: string;
  reason: ReviewRefusalReason;
}

export function reviewRefusalNotice({
  gameId,
  gameName,
  feedbackId,
  entryId,
  reason,
}: RefusedEntry): RefusalNotice {
  return {
    type: 'review-rejected',
    gameId,
    gameName,
    feedbackId,
    entryId,
    refusalReason: reason,
  };
}
