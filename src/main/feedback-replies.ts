import { z } from 'zod';
import type { FeedbackReplyPayload } from '../shared/types';
import { createDeltaStream } from './db/delta-stream';
import { getSupabaseClient } from './db/supabase-client';
import { keysetPages } from './db/sync-cursor';
import { getMachineId } from './tracking';
import { sendToRenderer } from './window';

const replySchema = z.object({
  replyId: z.string(),
  gameId: z.string(),
  gameName: z.string(),
  message: z.string(),
  createdAt: z.string(),
});

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

const replies = createDeltaStream({
  name: 'FeedbackReplies',
  watermarkKey: 'last_feedback_reply_sync',
  async *fetchSince(since) {
    const machineId = getMachineId();
    if (!machineId) {
      return;
    }
    if (!since) {
      yield { items: [], watermark: new Date().toISOString() };
      return;
    }
    const pages = keysetPages(
      (last: FeedbackReplyPayload | undefined) =>
        fetchReplyBatch(machineId, last?.createdAt ?? since),
      (page) => page.length === 0
    );
    for await (const batch of pages) {
      yield { items: batch, watermark: batch.at(-1)?.createdAt };
    }
  },
  apply: (items: FeedbackReplyPayload[], live) => {
    for (const reply of items) {
      sendToRenderer('feedback-reply', reply, live);
    }
  },
  realtime: () => {
    const machineId = getMachineId();
    if (!machineId) {
      return null;
    }
    return {
      topic: `feedback-replies:machine:${machineId}`,
      event: 'INSERT',
      schema: replySchema,
      toItems: (reply) => [reply],
    };
  },
});

export const syncFeedbackReplies = replies.catchUp;
export const createFeedbackReplyBroadcastSubscription = replies.subscription;
