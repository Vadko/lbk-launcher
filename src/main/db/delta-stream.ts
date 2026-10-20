import pLimit from 'p-limit';
import type { z } from 'zod';
import type { BroadcastSubscription } from './supabase-realtime';
import { getSyncMetadata, setSyncMetadata } from './sync-metadata';

interface DeltaBatch<T> {
  items: T[];
  watermark?: string;
}

interface DeltaRealtime<T, S extends z.ZodType> {
  topic: string;
  event: string;
  schema: S;
  toItems: (payload: z.infer<S>) => T[];
}

interface DeltaStreamOptions<T, S extends z.ZodType> {
  name: string;
  watermarkKey: string;
  fetchSince: (since: string | null) => AsyncIterable<DeltaBatch<T>>;
  apply: (items: T[], live: boolean) => void;
  realtime?: () => DeltaRealtime<T, S> | null;
}

interface DeltaStream {
  catchUp: () => Promise<void>;
  subscription: () => BroadcastSubscription | null;
}

export function createDeltaStream<T, S extends z.ZodType>(
  options: DeltaStreamOptions<T, S>
): DeltaStream {
  const { name, watermarkKey, fetchSince, apply, realtime } = options;

  const runCatchUp = async (): Promise<void> => {
    try {
      for await (const batch of fetchSince(getSyncMetadata(watermarkKey))) {
        if (batch.items.length > 0) {
          apply(batch.items, false);
        }
        if (batch.watermark) {
          setSyncMetadata(watermarkKey, batch.watermark);
        }
      }
    } catch (error) {
      console.error(`[${name}] Catch-up failed:`, error);
    }
  };

  // One pass at a time; a call during a pass queues another, since that pass's queries may predate what the caller saw
  const serial = pLimit(1);
  const catchUp = (): Promise<void> => serial(runCatchUp);

  const subscription = (): BroadcastSubscription | null => {
    const channel = realtime?.();
    if (!channel) {
      return null;
    }
    return {
      topic: channel.topic,
      handlers: [
        {
          event: channel.event,
          handler: (message) => {
            const parsed = channel.schema.safeParse(message.payload);
            if (!parsed.success) {
              console.warn(
                `[${name}] Ignoring malformed broadcast:`,
                parsed.error.message
              );
              return;
            }
            const items = channel.toItems(parsed.data);
            if (items.length > 0) {
              apply(items, true);
            }
          },
        },
      ],
      onResubscribe: () => void catchUp(),
    };
  };

  return { catchUp, subscription };
}
