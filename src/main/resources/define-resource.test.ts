import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceKey, ResourceUpdate } from '@/shared/resources';
import type { Game } from '@/shared/types';
import type { WeeklyPicks } from '@/shared/weekly-picks-types';
import type { ResourceDefinition } from './define-resource';
import { sink } from './resource-sink.fixture';

const state = vi.hoisted(() => ({ catalogReady: true }));

vi.mock('@/main/sync-status', () => ({ isCatalogReady: () => state.catalogReady }));

async function load() {
  vi.resetModules();
  const { defineResource } = await import('./define-resource');
  const hub = await import('./resource-hub');
  const { appEvents } = await import('@/main/app-events');
  const page = sink();
  const session = hub.openResourceSession(page);
  return { defineResource, appEvents, page, session, ...hub };
}

let env: Awaited<ReturnType<typeof load>>;

// Runs what is already due, short of the 300 ms debounce
const flush = () => vi.advanceTimersByTimeAsync(0);
const settle = () => vi.advanceTimersByTimeAsync(1000);

const request = {
  change: async () => {
    env.appEvents.emit('likes-changed');
    await settle();
  },
  subscribe: async () => {
    env.session.receive({ subscribe: ['likedGameIds'] });
    await flush();
  },
};

async function subscribed<K extends ResourceKey>(
  key: K,
  definition: ResourceDefinition<K>
) {
  env.defineResource(key, definition);
  env.session.receive({ subscribe: [key] });
  await flush();
}

type Ids = ReadonlySet<string>;

// Each call waits for finish(); the nth call resolves with the nth value, the last one repeating
function controlledRead(...values: Ids[]) {
  const pending: Array<() => void> = [];
  const read = vi.fn(
    () =>
      new Promise<Ids>((resolve) => {
        const value = values[Math.min(read.mock.calls.length, values.length) - 1];
        pending.push(() => resolve(value));
      })
  );
  return { read, finish: () => pending.shift()?.() };
}

const ids = (...list: string[]): Ids => new Set(list);
const liked = (value: Ids): ResourceUpdate => ({
  values: { likedGameIds: value },
  failed: [],
});
const likedFailed: ResourceUpdate = { values: {}, failed: ['likedGameIds'] };
const game = (id: string, likes: number) => ({ id, likes }) as Game;
const picks = (likes: number): WeeklyPicks => ({
  title: null,
  games: [game('a', likes)],
});
const picked = (likes: number, ...failed: ResourceKey[]): ResourceUpdate => ({
  values: { weeklyPicks: picks(likes) },
  failed,
});
const withCounters = (value: WeeklyPicks | null, games: readonly Game[]) =>
  value && games.length > 0 ? { ...value, games } : value;
const locked = () => {
  throw new Error('locked');
};

beforeEach(async () => {
  vi.useFakeTimers();
  state.catalogReady = true;
  env = await load();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('before the first subscribe', () => {
  it('reads nothing and follows no source event until the page subscribes', async () => {
    const read = vi.fn(() => ids('a'));
    env.defineResource('likedGameIds', { read, on: ['likes-changed'] });

    await request.change();

    expect(read).not.toHaveBeenCalled();
    expect(env.page.sent).toEqual([]);

    await request.subscribe();
    await request.change();

    expect(read).toHaveBeenCalledTimes(2);
    expect(env.page.sent).toEqual([liked(ids('a'))]);
  });
});

describe('subscribe', () => {
  it('reads at once on every subscribe, the same key again and a new page alike', async () => {
    const read = vi.fn(() => ids('a'));
    await subscribed('likedGameIds', { read, on: [] });
    expect(read).toHaveBeenCalledOnce();

    await request.subscribe();
    expect(read).toHaveBeenCalledTimes(2);

    const next = sink();
    env.openResourceSession(next).receive({ subscribe: ['likedGameIds'] });
    await flush();
    expect(read).toHaveBeenCalledTimes(3);

    expect(env.page.sent).toEqual([liked(ids('a'))]);
    expect(next.sent).toEqual([liked(ids('a'))]);
  });
});

describe('source events', () => {
  it('reads a burst of five changes once, 300 ms after the last', async () => {
    const read = vi.fn(() => ids('a'));
    await subscribed('likedGameIds', { read, on: ['likes-changed', 'catalog-changed'] });
    read.mockClear();

    for (const event of [
      'likes-changed',
      'catalog-changed',
      'likes-changed',
      'catalog-changed',
      'likes-changed',
    ] as const) {
      env.appEvents.emit(event);
      await vi.advanceTimersByTimeAsync(200);
    }
    await vi.advanceTimersByTimeAsync(99);

    expect(read).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(read).toHaveBeenCalledOnce();
  });
});

describe('timers', () => {
  it('leaves none behind once a read has settled', async () => {
    await subscribed('likedGameIds', { read: () => ids('a'), on: ['likes-changed'] });

    await request.change();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('one read at a time', () => {
  it.each<[string, Array<keyof typeof request>]>([
    ['a change', ['change']],
    ['three changes', ['change', 'change', 'change']],
    ['a subscribe', ['subscribe']],
    ['a change and a subscribe that joins its queued read', ['change', 'subscribe']],
    ['a subscribe and a change that joins its queued read', ['subscribe', 'change']],
  ])(
    'reads once more, after the running read, for %s during it',
    async (_label, asked) => {
      const { read, finish } = controlledRead(ids('a'), ids('b'));
      await subscribed('likedGameIds', { read, on: ['likes-changed'] });

      for (const name of asked) {
        await request[name]();
      }

      expect(read).toHaveBeenCalledOnce();

      finish();
      await flush();

      expect(read).toHaveBeenCalledTimes(2);

      finish();
      await settle();

      expect(read).toHaveBeenCalledTimes(2);
      expect(env.page.sent).toEqual([liked(ids('a')), liked(ids('b'))]);
    }
  );
});

describe('the catalog sync', () => {
  it('reads the catalog only once it is ready, at once on the sync-status that says so', async () => {
    state.catalogReady = false;
    const read = vi.fn(() => []);
    await subscribed('facetRows', {
      read,
      on: ['catalog-changed'],
      afterCatalogSync: true,
    });

    env.appEvents.emit('catalog-changed');
    await settle();
    env.appEvents.emit('sync-status', 'syncing');
    await flush();

    expect(read).not.toHaveBeenCalled();

    state.catalogReady = true;
    env.appEvents.emit('sync-status', 'ready');
    await flush();

    expect(read).toHaveBeenCalledOnce();
  });

  it('reads at once on every sync-status after the first subscribe', async () => {
    const read = vi.fn(() => []);
    env.defineResource('facetRows', { read, on: [], afterCatalogSync: true });

    env.appEvents.emit('sync-status', 'ready');
    await flush();

    expect(read).not.toHaveBeenCalled();

    env.session.receive({ subscribe: ['facetRows'] });
    await flush();
    env.appEvents.emit('sync-status', 'error');
    await flush();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('neither waits for nor follows the sync for a key that does not read the catalog', async () => {
    state.catalogReady = false;
    const read = vi.fn(() => ids('a'));
    await subscribed('likedGameIds', { read, on: [] });

    state.catalogReady = true;
    env.appEvents.emit('sync-status', 'ready');
    await flush();

    expect(read).toHaveBeenCalledOnce();
  });
});

describe('a failed read', () => {
  it.each([
    ['throws', locked],
    ['rejects', () => Promise.reject(new Error('locked'))],
    [
      'rejects with an AbortError',
      () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    ],
    ['has not settled after 30 s', () => new Promise<never>(() => undefined)],
  ])('reports a read that %s and keeps the last value', async (_label, fail) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn<() => Ids | Promise<Ids>>(() => ids('a'));
    await subscribed('likedGameIds', { read, on: ['likes-changed'] });
    read.mockImplementationOnce(fail);

    env.appEvents.emit('likes-changed');
    await vi.advanceTimersByTimeAsync(300 + 30_000);
    const next = sink();
    env.openResourceSession(next);

    expect(error).toHaveBeenCalledWith(
      '[Resources] Failed to read likedGameIds:',
      expect.any(Error)
    );
    expect(env.page.sent).toEqual([liked(ids('a')), likedFailed]);
    expect(next.sent).toEqual([{ ...liked(ids('a')), failed: ['likedGameIds'] }]);
  });

  it('reports a key once while it stays failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn<() => Ids>(() => ids('a'));
    await subscribed('likedGameIds', { read, on: ['likes-changed'] });
    read.mockImplementation(locked);

    await request.change();
    await request.change();
    await request.subscribe();

    expect(error).toHaveBeenCalledTimes(3);
    expect(env.page.sent).toEqual([liked(ids('a')), likedFailed]);
  });

  it.each<[string, keyof typeof request]>([
    ['the next change', 'change'],
    ['the next subscribe', 'subscribe'],
  ])(
    'reads a failed key again on %s and clears it with an equal value',
    async (_label, next) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const read = vi.fn<() => Ids>(() => ids('a'));
      await subscribed('likedGameIds', { read, on: ['likes-changed'] });
      read.mockImplementationOnce(locked);
      await request.change();

      await request[next]();

      expect(read).toHaveBeenCalledTimes(3);
      expect(env.page.sent).toEqual([liked(ids('a')), likedFailed, liked(ids('a'))]);
    }
  );

  it('abandons a read after 30 s, starts the queued one beside it and drops its late value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { read, finish } = controlledRead(ids('late'), ids('b'));
    await subscribed('likedGameIds', { read, on: ['likes-changed'] });
    await request.change();
    await vi.advanceTimersByTimeAsync(30_000 - 1000 - 1);

    expect(read).toHaveBeenCalledOnce();
    expect(env.page.sent).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);

    expect(read).toHaveBeenCalledTimes(2);
    expect(env.page.sent).toEqual([likedFailed]);

    finish();
    finish();
    await settle();

    expect(env.page.sent).toEqual([likedFailed, liked(ids('b'))]);
  });
});

describe('an owner publish', () => {
  it('reaches the next page in its snapshot, and the subscribe still reads once', async () => {
    const read = vi.fn(() => ids('b'));
    env.defineResource('likedGameIds', { read, on: [] });

    env.publishResource('likedGameIds', ids('a'));
    const next = sink();
    const session = env.openResourceSession(next);

    expect(env.page.sent).toEqual([liked(ids('a'))]);
    expect(next.sent).toEqual([liked(ids('a'))]);
    expect(read).not.toHaveBeenCalled();

    session.receive({ subscribe: ['likedGameIds'] });
    await settle();

    expect(read).toHaveBeenCalledOnce();
    expect(next.sent).toEqual([liked(ids('a')), liked(ids('b'))]);
  });
});

describe('the counters feed', () => {
  it('lays its rows over the held value without a read', async () => {
    const read = vi.fn(() => picks(1));
    await subscribed('weeklyPicks', { read, on: [], withCounters });

    env.appEvents.emit('counters-changed', [game('a', 9)]);

    expect(read).toHaveBeenCalledOnce();
    expect(env.page.sent).toEqual([picked(1), picked(9)]);
  });

  it('sends nothing for rows the patch leaves the value alone for', async () => {
    await subscribed('weeklyPicks', { read: () => picks(1), on: [], withCounters });

    env.appEvents.emit('counters-changed', []);

    expect(env.page.sent).toEqual([picked(1)]);
  });

  it('sends nothing and reads nothing while no value is held', async () => {
    state.catalogReady = false;
    const read = vi.fn(() => picks(1));
    await subscribed('weeklyPicks', {
      read,
      on: [],
      afterCatalogSync: true,
      withCounters,
    });

    env.appEvents.emit('counters-changed', [game('a', 9)]);
    await settle();

    expect(read).not.toHaveBeenCalled();
    expect(env.page.sent).toEqual([]);
  });

  it('patches nothing before the page subscribes', () => {
    env.defineResource('weeklyPicks', { read: () => null, on: [], withCounters });
    env.publishResource('weeklyPicks', picks(1));

    env.appEvents.emit('counters-changed', [game('a', 9)]);

    expect(env.page.sent).toEqual([picked(1)]);
  });

  it('keeps a failed key failed when it patches its value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn<() => WeeklyPicks>(() => picks(1));
    await subscribed('weeklyPicks', { read, on: ['weekly-picks-changed'], withCounters });
    read.mockImplementationOnce(locked);
    env.appEvents.emit('weekly-picks-changed');
    await settle();

    env.appEvents.emit('counters-changed', [game('a', 9)]);

    expect(env.page.sent.at(-1)).toEqual(picked(9, 'weeklyPicks'));
  });
});

describe('a patch that throws', () => {
  it('reads the key in full instead and lets the other listeners run', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(() => picks(1));
    await subscribed('weeklyPicks', { read, on: [], withCounters: locked });
    const later = vi.fn();
    env.appEvents.on('counters-changed', later);

    expect(() => env.appEvents.emit('counters-changed', [game('a', 9)])).not.toThrow();
    await flush();

    expect(error).toHaveBeenCalledWith(
      '[Resources] Failed to patch weeklyPicks:',
      expect.any(Error)
    );
    expect(later).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('a page that cannot take a message', () => {
  it('does not fail the read whose value it could not take', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env.page.postMessage.mockImplementationOnce(() => {
      throw new Error('port closed');
    });

    await subscribed('likedGameIds', { read: () => ids('a'), on: [] });
    const next = sink();
    env.openResourceSession(next);

    expect(error).toHaveBeenCalledWith(
      '[Resources] Failed to publish:',
      expect.any(Error)
    );
    expect(error).not.toHaveBeenCalledWith(
      '[Resources] Failed to read likedGameIds:',
      expect.anything()
    );
    expect(next.sent).toEqual([liked(ids('a'))]);
  });

  it('throws nothing into the counters-changed emitter', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await subscribed('weeklyPicks', { read: () => picks(1), on: [], withCounters });
    const later = vi.fn();
    env.appEvents.on('counters-changed', later);
    env.page.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });

    expect(() => env.appEvents.emit('counters-changed', [game('a', 9)])).not.toThrow();
    expect(later).toHaveBeenCalledOnce();
  });
});

describe('without a page', () => {
  it('keeps a started key current and hands the next page what changed', async () => {
    const read = vi.fn(() => ids('a'));
    await subscribed('likedGameIds', { read, on: ['likes-changed'] });
    env.session.end();
    read.mockReturnValue(ids('b'));

    await request.change();
    const next = sink();
    env.openResourceSession(next);

    expect(read).toHaveBeenCalledTimes(2);
    expect(env.page.sent).toEqual([liked(ids('a'))]);
    expect(next.sent).toEqual([liked(ids('b'))]);
  });
});
