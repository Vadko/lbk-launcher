import { z } from 'zod';
import { type ReviewEvent, reviewEventSchema } from '../shared/game-reviews-types';
import { createDeltaStream } from './db/delta-stream';
import { keepValid } from './db/keep-valid';
import { callReviewFunction } from './db/review-request';
import { latest, rewind } from './db/sync-cursor';
import { getSyncMetadata } from './db/sync-metadata';
import { getMachineId } from './tracking';
import { sendToRenderer } from './window';

// get_machine_review_events ends a page only between two values of at, so a full page may run past this
const PAGE_SIZE = 200;
// An event committed late carries an at just before the ones a previous catch-up already read
const OVERLAP_MS = 5_000;
// The replies stream this one replaced; its watermark seeds this one once
const LEGACY_WATERMARK_KEY = 'last_feedback_reply_sync';

const pageSchema = z.object({ events: z.array(z.unknown()) });
// Only the at of a page's last item, so a page whose every event this build drops still pages on
const lastAtSchema = reviewEventSchema.pick({ at: true });

// The renderer's bridge turns it on once its listener is set; window.ts turns it off when the page goes
let listening = false;

interface EventsPage {
  events: ReviewEvent[];
  // Before the bad items are dropped, since only the server's count says whether more follow
  size: number;
  // The raw last item's, where the next page starts; null when it has none
  lastAt: string | null;
}

// null when the server could not be asked or answered oddly; callReviewFunction already logged why
async function fetchPage(since: string): Promise<EventsPage | null> {
  const result = await callReviewFunction(
    'get-feedback-replies',
    { since, version: 2 },
    pageSchema
  );
  if (!result.ok) {
    return null;
  }
  const { events } = result.data;
  return {
    events: keepValid(events, reviewEventSchema, 'review events'),
    size: events.length,
    lastAt: lastAtSchema.safeParse(events.at(-1)).data?.at ?? null,
  };
}

const reviewEvents = createDeltaStream({
  name: 'ReviewEvents',
  watermarkKey: 'review_events_synced_at',
  async *fetchSince(stored) {
    // Without a listening page nothing receives the events, so the watermark waits for the next page to ask
    if (!getMachineId() || !listening) {
      return;
    }
    let since = stored;
    if (!since) {
      const legacy = getSyncMetadata(LEGACY_WATERMARK_KEY);
      since = legacy ?? new Date().toISOString();
      yield { items: [], watermark: since };
      // Without a watermark the server answers nothing, so history is never backfilled
      if (!legacy) {
        return;
      }
    }
    let cursor = rewind(since, OVERLAP_MS);
    for (;;) {
      const page = await fetchPage(cursor);
      if (!page || !listening) {
        return;
      }
      const last = page.events.at(-1);
      yield {
        items: page.events,
        watermark: latest(since, last ? [last.at] : []) ?? undefined,
      };
      if (!page.lastAt || page.size < PAGE_SIZE) {
        return;
      }
      cursor = page.lastAt;
    }
  },
  // The overlap and the live stream repeat events, which the renderer's seen lists drop
  apply: (items: ReviewEvent[], live) => {
    if (listening) {
      sendToRenderer('review-events', items, live);
    }
  },
  realtime: () => {
    const machineId = getMachineId();
    if (!machineId) {
      return null;
    }
    // The topic also carries the legacy 'INSERT' of staff replies, which only shipped launchers read
    return {
      topic: `feedback-replies:machine:${machineId}`,
      event: 'review',
      schema: reviewEventSchema,
      toItems: (event) => [event],
    };
  },
});

export function syncReviewEvents(): Promise<void> {
  listening = true;
  return reviewEvents.catchUp();
}

export function stopReviewEvents(): void {
  listening = false;
}

export const createReviewEventsSubscription = reviewEvents.subscription;
