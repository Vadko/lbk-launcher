import type { FeedbackReplyPayload } from '../shared/types';
import { getSupabaseClient } from './db/supabase-client';
import type { BroadcastSubscription } from './db/supabase-realtime';
import { getSyncMetadata, setSyncMetadata } from './db/sync-metadata';
import { getMachineId } from './tracking';
import { getMainWindow } from './window';

const WATERMARK_KEY = 'last_feedback_reply_sync';

function deliverReply(reply: FeedbackReplyPayload, live: boolean): void {
  getMainWindow()?.webContents.send('feedback-reply', reply, live);
}

async function fetchReplyBatch(
  machineId: string,
  since: string
): Promise<FeedbackReplyPayload[]> {
  const { data, error } = await getSupabaseClient().functions.invoke<{
    success: boolean;
    replies: FeedbackReplyPayload[];
  }>('get-feedback-replies', { body: { machineId, since } });
  if (error) {
    throw error;
  }
  return data?.replies ?? [];
}

export async function syncFeedbackReplies(): Promise<void> {
  const machineId = getMachineId();
  if (!machineId) {
    return;
  }

  let since = getSyncMetadata(WATERMARK_KEY);
  if (!since) {
    setSyncMetadata(WATERMARK_KEY, new Date().toISOString());
    return;
  }

  try {
    let batch = await fetchReplyBatch(machineId, since);
    while (batch.length > 0) {
      for (const reply of batch) {
        deliverReply(reply, false);
      }
      since = batch[batch.length - 1].createdAt;
      setSyncMetadata(WATERMARK_KEY, since);
      batch = await fetchReplyBatch(machineId, since);
    }
  } catch (error) {
    console.error('[FeedbackReplies] Catch-up failed:', error);
  }
}

export function createFeedbackReplyBroadcastSubscription(): BroadcastSubscription | null {
  const machineId = getMachineId();
  if (!machineId) {
    return null;
  }

  return {
    topic: `feedback-replies:machine:${machineId}`,
    handlers: [
      {
        event: 'INSERT',
        handler: (message) => {
          const reply = message.payload as FeedbackReplyPayload;
          if (reply?.replyId) {
            deliverReply(reply, true);
          }
        },
      },
    ],
    onResubscribe: () => void syncFeedbackReplies(),
  };
}
