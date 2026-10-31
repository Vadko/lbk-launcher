import type { EventEmitter } from 'node:events';
import type { WebContents, WebContentsDidStartNavigationEventParams } from 'electron';
import { z } from 'zod';
import { Constants } from '../lib/database.types';
import type { ReviewEvent } from '../shared/game-reviews-types';
import { createDeltaStream } from './db/delta-stream';
import { keepValid } from './db/keep-valid';
import { callReviewFunction } from './db/review-request';
import { latest, rewind } from './db/sync-cursor';
import { getSyncMetadata } from './db/sync-metadata';
import { getMachineId } from './tracking';

// get_machine_review_events ends a page only between two values of at, so a full page may run past this
const PAGE_SIZE = 200;
// An event committed late carries an at just before the ones a previous catch-up already read
const OVERLAP_MS = 5_000;
// The replies stream this one replaced; its watermark seeds this one once
const LEGACY_WATERMARK_KEY = 'last_feedback_reply_sync';

const enums = Constants.public.Enums;
const timestamp = z.iso.datetime({ offset: true });

// Matches broadcast_feedback_reply(), broadcast_review_moderation() and get_machine_review_events() in lbk-admin migration 198
const eventSchema: z.ZodType<ReviewEvent> = z.object({
  kind: z.enum(['reply', 'moderation']),
  gameId: z.string(),
  gameName: z.string(),
  feedbackId: z.string(),
  entryId: z.string(),
  parentId: z.string().nullable(),
  authorName: z.string().nullable(),
  authorRole: z.enum(enums.review_author_role),
  message: z.string().nullable(),
  outcome: z.enum(enums.review_moderation),
  editRejected: z.boolean(),
  createdAt: timestamp,
  editedAt: timestamp.nullable(),
  at: timestamp,
});

const pageSchema = z.object({ events: z.array(z.unknown()) });

type ListeningPage = EventEmitter & Pick<WebContents, 'send'>;

// The page whose bridge asked for a catch-up, so its listener is on; a reload, crash or closed window clears it
let listener: ListeningPage | null = null;
const tracked = new WeakSet<ListeningPage>();
// Between a main-frame navigation's start and its commit, a sync can only come from the document being replaced
const replacing = new WeakSet<ListeningPage>();

function release(page: ListeningPage): void {
  if (listener === page) {
    listener = null;
  }
}

// Kept for the page's whole life: the old document's sync can arrive after its navigation started
function track(page: ListeningPage): void {
  if (tracked.has(page)) {
    return;
  }
  tracked.add(page);
  page.on(
    'did-start-navigation',
    ({ isMainFrame, isSameDocument }: WebContentsDidStartNavigationEventParams) => {
      if (isMainFrame && !isSameDocument) {
        replacing.add(page);
        release(page);
      }
    }
  );
  page.on('did-navigate', () => replacing.delete(page));
  page.on('render-process-gone', () => release(page));
  page.on('destroyed', () => release(page));
}

interface EventsPage {
  events: ReviewEvent[];
  // Before the bad items are dropped, since only the server's count says whether more follow
  size: number;
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
  return { events: keepValid(events, eventSchema, 'review events'), size: events.length };
}

// Without since the server answers nothing at once, so the call only reads its clock
async function serverTime(): Promise<string | null> {
  let at: string | null = null;
  await callReviewFunction('get-feedback-replies', { version: 2 }, pageSchema, {
    onServerTime: (time) => {
      at = time;
    },
  });
  return at;
}

// A local clock running fast, or the replaced stream's seed taken from one, would start past events still to come
async function seedWatermark(): Promise<{ since: string; legacy: boolean }> {
  const legacy = getSyncMetadata(LEGACY_WATERMARK_KEY);
  const now = await serverTime();
  if (legacy && now && Date.parse(now) < Date.parse(legacy)) {
    return { since: now, legacy: true };
  }
  return { since: legacy ?? now ?? new Date().toISOString(), legacy: legacy !== null };
}

const reviewEvents = createDeltaStream({
  name: 'ReviewEvents',
  watermarkKey: 'review_events_synced_at',
  async *fetchSince(stored) {
    // Without a listening page nothing receives the events, so the watermark waits for the next page to ask
    if (!getMachineId() || !listener) {
      return;
    }
    let since = stored;
    if (!since) {
      const seed = await seedWatermark();
      since = seed.since;
      yield { items: [], watermark: since };
      // Without a watermark the server answers nothing, so history is never backfilled
      if (!seed.legacy) {
        return;
      }
    }
    let cursor = rewind(since, OVERLAP_MS);
    for (;;) {
      const page = await fetchPage(cursor);
      if (!page || !listener) {
        return;
      }
      const last = page.events.at(-1);
      yield {
        items: page.events,
        watermark: latest(since, last ? [last.at] : []) ?? undefined,
      };
      if (!last || page.size < PAGE_SIZE) {
        return;
      }
      cursor = last.at;
    }
  },
  // The overlap and the live stream repeat events, which the renderer's seen lists drop
  apply: (items: ReviewEvent[], live) => listener?.send('review-events', items, live),
  realtime: () => {
    const machineId = getMachineId();
    if (!machineId) {
      return null;
    }
    // The topic also carries the legacy 'INSERT' of staff replies, which only shipped launchers read
    return {
      topic: `feedback-replies:machine:${machineId}`,
      event: 'review',
      schema: eventSchema,
      toItems: (event) => [event],
    };
  },
});

// The page calls this once its listener is on, and every later catch-up delivers to it
export function syncReviewEvents(page: ListeningPage): Promise<void> {
  track(page);
  if (replacing.has(page)) {
    return Promise.resolve();
  }
  listener = page;
  return reviewEvents.catchUp();
}

export const createReviewEventsSubscription = reviewEvents.subscription;
