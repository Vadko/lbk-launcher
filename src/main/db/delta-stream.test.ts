import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { BroadcastMessage } from './supabase-realtime';

const metadata = vi.hoisted(() => new Map<string, string>());

vi.mock('@/main/db/sync-metadata', () => ({
  getSyncMetadata: (key: string) => metadata.get(key) ?? null,
  setSyncMetadata: (key: string, value: string) => metadata.set(key, value),
}));

const { createDeltaStream } = await import('./delta-stream');

type Batch = { items: string[]; watermark?: string };

function makeStream(batches: (since: string | null) => Batch[] | Error) {
  const apply = vi.fn<(items: string[], live: boolean) => void>();
  const fetches: (string | null)[] = [];
  const stream = createDeltaStream({
    name: 'Test',
    watermarkKey: 'test_watermark',
    async *fetchSince(since) {
      fetches.push(since);
      const result = batches(since);
      if (result instanceof Error) {
        throw result;
      }
      for (const batch of result) {
        await Promise.resolve();
        yield batch;
      }
    },
    apply,
    realtime: () => ({
      topic: 'test-topic',
      event: 'items',
      schema: z.object({ items: z.array(z.string()) }),
      toItems: ({ items }) => items,
    }),
  });
  return { stream, apply, fetches };
}

const broadcast = (payload: unknown): BroadcastMessage => ({
  event: 'items',
  type: 'broadcast',
  payload,
});

beforeEach(() => {
  metadata.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('catchUp', () => {
  it('starts from the stored watermark and saves only the ones batches carry', async () => {
    metadata.set('test_watermark', 'w0');
    const { stream, apply, fetches } = makeStream(() => [
      { items: ['a', 'b'] },
      { items: [], watermark: 'w1' },
      { items: ['c'], watermark: 'w2' },
    ]);

    await stream.catchUp();

    expect(fetches).toEqual(['w0']);
    expect(apply.mock.calls).toEqual([
      [['a', 'b'], false],
      [['c'], false],
    ]);
    expect(metadata.get('test_watermark')).toBe('w2');
  });

  it('keeps the earlier watermark when a later page fails', async () => {
    const { stream } = makeStream((since) =>
      since === null ? [{ items: ['a'], watermark: 'w1' }] : new Error('offline')
    );

    await stream.catchUp();
    await stream.catchUp();

    expect(metadata.get('test_watermark')).toBe('w1');
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('runs a call made during a pass after it, never alongside', async () => {
    const gate = { open: (): void => undefined };
    const opened = new Promise<void>((resolve) => {
      gate.open = resolve;
    });
    const passes: string[] = [];
    const stream = createDeltaStream({
      name: 'Test',
      watermarkKey: 'test_watermark',
      async *fetchSince() {
        passes.push('start');
        await opened;
        passes.push('end');
        yield* [];
      },
      apply: vi.fn(),
    });

    const first = stream.catchUp();
    const second = stream.catchUp();
    await Promise.resolve();
    expect(passes).toEqual(['start']);

    gate.open();
    await Promise.all([first, second]);
    expect(passes).toEqual(['start', 'end', 'start', 'end']);
  });
});

describe('subscription', () => {
  it.each([
    ['a valid payload', { items: ['x', 'y'] }, [[['x', 'y'], true]]],
    ['an empty batch', { items: [] }, []],
    ['a malformed payload', { items: 'x' }, []],
    ['no payload', undefined, []],
  ])('%s', (_, payload, calls) => {
    const { stream, apply } = makeStream(() => []);
    const subscription = stream.subscription();

    subscription?.handlers[0].handler(broadcast(payload));

    expect(subscription?.topic).toBe('test-topic');
    expect(apply.mock.calls).toEqual(calls);
  });

  it('catches up again after a resubscribe', async () => {
    const { stream, fetches } = makeStream(() => []);

    stream.subscription()?.onResubscribe?.();
    await vi.waitFor(() => expect(fetches).toHaveLength(1));
  });

  it('has no subscription when realtime is unavailable', () => {
    const stream = createDeltaStream({
      name: 'Test',
      watermarkKey: 'test_watermark',
      async *fetchSince() {
        yield* [];
      },
      apply: vi.fn(),
      realtime: () => null,
    });

    expect(stream.subscription()).toBeNull();
  });
});
