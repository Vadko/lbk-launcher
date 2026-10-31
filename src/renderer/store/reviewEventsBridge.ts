import { handleReviewEvents } from '../queries/handleReviewEvents';
import { queryClient } from '../queries/queryClient';

export function initReviewEvents(): void {
  const api = window.electronAPI;
  if (!api?.onReviewEvents || !api.syncReviewEvents) {
    return;
  }

  api.onReviewEvents((events, live) => handleReviewEvents(queryClient, events, live));

  void api.syncReviewEvents();
}
