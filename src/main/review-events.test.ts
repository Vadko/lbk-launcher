import { FunctionsFetchError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewEvent } from '../shared/game-reviews-types';
import { answered, invokeCalls, MACHINE_ID } from './db/review-functions.fixture';
import type { BroadcastMessage } from './db/supabase-realtime';

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  send: vi.fn<(channel: string, events: ReviewEvent[], live: boolean) => void>(),
  metadata: new Map<string, string>(),
  machineId: 'machine-1' as string | null,
}));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke: state.invoke } }),
}));
vi.mock('@/main/tracking', () => ({
  IS_E2E: false,
  getMachineId: () => state.machineId,
}));
vi.mock('@/main/window', () => ({ sendToRenderer: state.send }));
vi.mock('@/main/db/sync-metadata', () => ({
  getSyncMetadata: (key: string) => state.metadata.get(key) ?? null,
  setSyncMetadata: (key: string, value: string) => state.metadata.set(key, value),
}));

const { syncReviewEvents, stopReviewEvents, createReviewEventsSubscription } =
  await import('./review-events');

const WATERMARK = 'review_events_synced_at';
const LEGACY = 'last_feedback_reply_sync';
const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
// to_jsonb(timestamptz) keeps microseconds, which a round trip through Date would lose
const AT = '2026-10-29T10:00:00.123456+00:00';

let nextId = 0;
const event = (extra: Record<string, unknown> = {}) => ({
  kind: 'reply',
  gameId: GAME,
  gameName: 'Game',
  feedbackId: 'f1',
  entryId: `e${++nextId}`,
  parentId: null,
  authorName: 'Nick',
  authorRole: 'player',
  message: 'hi',
  outcome: 'published',
  editRejected: false,
  createdAt: AT,
  editedAt: null,
  at: AT,
  ...extra,
});

const atSecond = (second: number) =>
  new Date(Date.UTC(2026, 9, 29, 11, 0, second)).toISOString();

const page = (events: unknown[]) => answered({ events });

const delivered = () =>
  state.send.mock.calls.flatMap(([, items, live]) => items.map((item) => [item, live]));

const sinceOfCalls = () =>
  invokeCalls(state.invoke.mock.calls).map(({ body }) => body['since']);

const broadcast = (payload: unknown): BroadcastMessage => ({
  event: 'review',
  type: 'broadcast',
  payload,
});

function live(payload: unknown): void {
  const handler = createReviewEventsSubscription()?.handlers[0];
  handler?.handler(broadcast(payload));
}

const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
vi.spyOn(console, 'warn').mockImplementation(() => undefined);

beforeEach(() => {
  state.invoke.mockReset();
  state.send.mockReset();
  state.metadata.clear();
  state.machineId = MACHINE_ID;
  stopReviewEvents();
  error.mockClear();
});

describe('live review events', () => {
  beforeEach(async () => {
    await syncReviewEvents();
    state.metadata.clear();
  });

  it('listens to the review event only, on the machine topic', () => {
    const subscription = createReviewEventsSubscription();

    expect(subscription?.topic).toBe(`feedback-replies:machine:${MACHINE_ID}`);
    expect(subscription?.handlers.map((handler) => handler.event)).toEqual(['review']);
  });

  it('hands a live payload to the renderer as it came', () => {
    const payload = event({ kind: 'moderation', outcome: 'removed', message: null });

    live(payload);

    expect(state.send).toHaveBeenCalledWith('review-events', [payload], true);
  });

  it('drops a live payload while no page listens, leaving it to the next catch-up', () => {
    stopReviewEvents();

    live(event());

    expect(state.send).not.toHaveBeenCalled();
  });

  it('ignores a malformed payload', () => {
    live({ ...event(), authorRole: 'admin' });

    expect(state.send).not.toHaveBeenCalled();
  });

  it('subscribes to nothing without a machine id', () => {
    state.machineId = null;

    expect(createReviewEventsSubscription()).toBeNull();
  });
});

describe('syncReviewEvents', () => {
  it('asks the v2 catch-up a few seconds before the watermark', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T10:00:05.000Z');
    state.invoke.mockResolvedValue(page([]));

    await syncReviewEvents();

    expect(invokeCalls(state.invoke.mock.calls)).toEqual([
      {
        name: 'get-feedback-replies',
        body: { since: '2026-10-29T10:00:00.000Z', version: 2, machineId: MACHINE_ID },
        timeout: 15_000,
      },
    ]);
  });

  it('delivers a catch-up item silently and keeps its at verbatim as the watermark', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    const item = event();
    state.invoke.mockResolvedValue(page([item]));

    await syncReviewEvents();

    expect(delivered()).toEqual([[item, false]]);
    expect(state.metadata.get(WATERMARK)).toBe(AT);
  });

  it('drops a bad item alone and keeps the rest', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    const first = event({ at: atSecond(1) });
    const last = event({ at: atSecond(3) });
    state.invoke.mockResolvedValue(
      page([first, { ...event({ at: atSecond(2) }), outcome: 'hidden' }, last])
    );

    await syncReviewEvents();

    expect(delivered()).toEqual([
      [first, false],
      [last, false],
    ]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1 of 3 review events'),
      expect.any(String)
    );
  });

  it('pages on from the last at while a page is full, ties past 200 included', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    const ties = Array.from({ length: 201 }, () => event({ at: AT }));
    const tail = event({ at: '2026-10-29T10:00:01.5+00:00' });
    state.invoke.mockResolvedValueOnce(page(ties)).mockResolvedValueOnce(page([tail]));

    await syncReviewEvents();

    expect(sinceOfCalls()).toEqual(['2026-10-29T08:59:55.000Z', AT]);
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(delivered()).toHaveLength(202);
    expect(state.metadata.get(WATERMARK)).toBe('2026-10-29T10:00:01.5+00:00');
  });

  it('counts a full page by what the server sent, bad items included', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    const full = Array.from({ length: 199 }, () => event({ at: AT }));
    state.invoke
      .mockResolvedValueOnce(page([...full, { ...event({ at: AT }), outcome: 'hidden' }]))
      .mockResolvedValueOnce(page([]));

    await syncReviewEvents();

    expect(sinceOfCalls()).toEqual(['2026-10-29T08:59:55.000Z', AT]);
    expect(delivered()).toHaveLength(199);
  });

  it('stops at a page shorter than 200', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    state.invoke.mockResolvedValue(
      page(Array.from({ length: 199 }, (_, i) => event({ at: atSecond(i % 60) })))
    );

    await syncReviewEvents();

    expect(state.invoke).toHaveBeenCalledTimes(1);
  });

  it('keeps the watermark and throws nothing when the server is unreachable', async () => {
    state.metadata.set(WATERMARK, AT);
    state.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError('offline'),
    });

    await expect(syncReviewEvents()).resolves.toBeUndefined();

    expect(state.metadata.get(WATERMARK)).toBe(AT);
    expect(state.send).not.toHaveBeenCalled();
  });

  it('keeps the watermark of the pages it got when a later one fails', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    state.invoke
      .mockResolvedValueOnce(page(Array.from({ length: 200 }, () => event({ at: AT }))))
      .mockRejectedValueOnce(new Error('socket hang up'));

    await syncReviewEvents();

    expect(state.metadata.get(WATERMARK)).toBe(AT);
  });

  it('never moves the watermark back for events inside the overlap', async () => {
    state.metadata.set(WATERMARK, AT);
    state.invoke.mockResolvedValue(page([event({ at: '2026-10-29T09:59:58+00:00' })]));

    await syncReviewEvents();

    expect(state.metadata.get(WATERMARK)).toBe(AT);
  });

  it('hands an event the live stream already brought over again, for the renderer to drop', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    const seenLive = event();
    state.invoke.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([seenLive]));
    await syncReviewEvents();
    live(seenLive);

    await syncReviewEvents();

    expect(delivered()).toEqual([
      [seenLive, true],
      [seenLive, false],
    ]);
  });

  it('asks nothing and keeps the watermark on a join while no page listens', async () => {
    state.metadata.set(WATERMARK, AT);

    createReviewEventsSubscription()?.onSubscribed?.();
    await vi.waitFor(() => expect(state.metadata.get(WATERMARK)).toBe(AT));

    expect(state.invoke).not.toHaveBeenCalled();
    expect(state.metadata.get(WATERMARK)).toBe(AT);
  });

  it('keeps the watermark when the page goes while a catch-up is asking', async () => {
    state.metadata.set(WATERMARK, '2026-10-29T09:00:00Z');
    state.invoke.mockImplementation(() => {
      stopReviewEvents();
      return Promise.resolve(page([event()]));
    });

    await syncReviewEvents();

    expect(state.send).not.toHaveBeenCalled();
    expect(state.metadata.get(WATERMARK)).toBe('2026-10-29T09:00:00Z');
  });

  it('seeds its watermark from the replies stream it replaced', async () => {
    state.metadata.set(LEGACY, '2026-10-29T09:00:05Z');
    state.invoke.mockResolvedValue(page([]));

    await syncReviewEvents();

    expect(sinceOfCalls()).toEqual(['2026-10-29T09:00:00.000Z']);
    expect(state.metadata.get(WATERMARK)).toBe('2026-10-29T09:00:05Z');
  });

  it('starts from now, never asking for history, when there is no watermark at all', async () => {
    const before = Date.now();

    await syncReviewEvents();

    expect(state.invoke).not.toHaveBeenCalled();
    expect(Date.parse(state.metadata.get(WATERMARK) ?? '')).toBeGreaterThanOrEqual(
      before
    );
  });

  it('asks nothing and stores nothing without a machine id', async () => {
    state.machineId = null;

    await syncReviewEvents();

    expect(state.invoke).not.toHaveBeenCalled();
    expect(state.metadata.size).toBe(0);
  });
});
