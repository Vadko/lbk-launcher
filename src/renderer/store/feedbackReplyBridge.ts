import { useSubscriptionsStore } from './useSubscriptionsStore';

export function initFeedbackReplies(): void {
  const api = window.electronAPI;
  if (!api?.onFeedbackReply || !api.syncFeedbackReplies) {
    return;
  }

  api.onFeedbackReply((reply, live) =>
    useSubscriptionsStore.getState().addFeedbackReplyNotification(reply, live)
  );

  void api.syncFeedbackReplies();
}
