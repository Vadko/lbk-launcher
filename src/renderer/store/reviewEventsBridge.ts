import { handleReviewEvents } from '../queries/handleReviewEvents';
import { queryClient } from '../queries/queryClient';

export function initReviewEvents(): void {
  window.electronAPI.onReviewEvents((events, live) =>
    handleReviewEvents(queryClient, events, live)
  );
  void window.electronAPI.syncReviewEvents();
}
