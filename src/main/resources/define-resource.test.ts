import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceTrigger } from './define-resource';

const state = vi.hoisted(() => ({ catalogReady: true }));

vi.mock('@/main/sync-status', () => ({ isCatalogReady: () => state.catalogReady }));

async function load() {
  vi.resetModules();
  const { defineResource } = await import('./define-resource');
  const hub = await import('./resource-hub');
  const { appEvents } = await import('@/main/app-events');
  const page = { post: vi.fn(), close: vi.fn() };
  const session = hub.openResourceSession(page);
  return { defineResource, appEvents, page, session, ...hub };
}

const settle = () => vi.advanceTimersByTimeAsync(1000);

function controlledRead<T>(value: T) {
  const pending: Array<() => void> = [];
  const read = vi.fn(
    () =>
      new Promise<T>((resolve) => {
        pending.push(() => resolve(value));
      })
  );
  return { read, finish: () => pending.shift()?.() };
}

let env: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  vi.useFakeTimers();
  state.catalogReady = true;
  env = await load();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('defineResource', () => {
  it('reads nothing until the page subscribes, then publishes what it read', async () => {
    const read = vi.fn(() => null);
    env.defineResource('weeklyPicks', { read, on: ['weekly-picks-changed'] });

    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(read).not.toHaveBeenCalled();

    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(read).toHaveBeenCalledOnce();
    expect(env.page.post).toHaveBeenCalledWith({
      values: { weeklyPicks: null },
      failed: [],
    });
  });

  it('reads a burst of changes once, after it goes quiet', async () => {
    const read = vi.fn(() => new Set<string>());
    env.defineResource('likedGameIds', { read, on: ['likes-changed'] });
    env.session.receive({ subscribe: ['likedGameIds'] });
    await settle();
    read.mockClear();

    for (let i = 0; i < 20; i += 1) {
      env.appEvents.emit('likes-changed');
      await vi.advanceTimersByTimeAsync(200);
    }

    expect(read).not.toHaveBeenCalled();

    await settle();

    expect(read).toHaveBeenCalledOnce();
  });

  it('runs one read at a time and folds the changes during it into one more', async () => {
    const { read, finish } = controlledRead(null);
    env.defineResource('weeklyPicks', { read, on: ['weekly-picks-changed'] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();

    env.appEvents.emit('weekly-picks-changed');
    await settle();
    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(read).toHaveBeenCalledOnce();

    finish();
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps a value read for an earlier page instead of reading it again', async () => {
    const read = vi.fn(() => null);
    env.defineResource('weeklyPicks', { read, on: [] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();
    const next = { post: vi.fn(), close: vi.fn() };

    env.openResourceSession(next).receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(read).toHaveBeenCalledOnce();
    expect(next.post).toHaveBeenCalledWith({ values: { weeklyPicks: null }, failed: [] });
  });

  it('reads again for the next page what changed while no page was open', async () => {
    const read = vi.fn<() => null>(() => null);
    env.defineResource('weeklyPicks', { read, on: ['weekly-picks-changed'] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();
    env.session.end();

    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(read).toHaveBeenCalledOnce();

    const next = { post: vi.fn(), close: vi.fn() };
    env.openResourceSession(next).receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads again for the next page a key whose last read failed', async () => {
    const read = vi.fn<() => null>(() => null);
    read.mockImplementationOnce(() => {
      throw new Error('locked');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env.defineResource('weeklyPicks', { read, on: [] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();
    const next = { post: vi.fn(), close: vi.fn() };

    env.openResourceSession(next).receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
    expect(next.post).toHaveBeenLastCalledWith({
      values: { weeklyPicks: null },
      failed: [],
    });
  });

  it('takes a value its owner published before the page asked without reading it', async () => {
    const read = vi.fn(() => null);
    env.defineResource('weeklyPicks', { read, on: [] });
    env.publishResource('weeklyPicks', null);

    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(read).not.toHaveBeenCalled();
    expect(env.page.post).toHaveBeenCalledWith({
      values: { weeklyPicks: null },
      failed: [],
    });
  });

  it('reads the catalog only once the first sync is over', async () => {
    state.catalogReady = false;
    const read = vi.fn(() => []);
    env.defineResource('facetRows', { read, on: [], afterCatalogSync: true });
    env.session.receive({ subscribe: ['facetRows'] });
    await settle();

    expect(read).not.toHaveBeenCalled();

    state.catalogReady = true;
    env.appEvents.emit('sync-status', 'ready');
    await vi.advanceTimersByTimeAsync(0);

    expect(read).toHaveBeenCalledOnce();
  });

  it('reports a failed read, keeps the last value and reads again on the next change', async () => {
    const read = vi.fn<() => null>(() => null);
    env.defineResource('weeklyPicks', { read, on: ['weekly-picks-changed'] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    read.mockImplementationOnce(() => {
      throw new Error('locked');
    });

    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(env.page.post).toHaveBeenLastCalledWith({
      values: {},
      failed: ['weeklyPicks'],
    });
    expect(env.getResource('weeklyPicks')).toBeNull();

    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
    expect(env.page.post).toHaveBeenLastCalledWith({
      values: { weeklyPicks: null },
      failed: [],
    });
  });

  it('fails a read that never settles and reads again on the next change', async () => {
    const read = vi.fn<() => Promise<null>>(() => new Promise(() => undefined));
    env.defineResource('weeklyPicks', { read, on: ['weekly-picks-changed'] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(env.page.post).toHaveBeenLastCalledWith({
      values: {},
      failed: ['weeklyPicks'],
    });

    read.mockResolvedValueOnce(null);
    env.appEvents.emit('weekly-picks-changed');
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
    expect(env.page.post).toHaveBeenLastCalledWith({
      values: { weeklyPicks: null },
      failed: [],
    });
  });

  it('does not report a read as failed when sending its value throws', async () => {
    const read = vi.fn(() => null);
    env.defineResource('weeklyPicks', { read, on: [] });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env.page.post.mockImplementationOnce(() => {
      throw new Error('port closed');
    });

    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();

    expect(env.page.post).toHaveBeenCalledOnce();
    expect(env.getResource('weeklyPicks')).toBeNull();
    expect(error).toHaveBeenCalledWith(
      '[Resources] Failed to publish weeklyPicks:',
      expect.any(Error)
    );
  });

  it('hands a trigger function the refresh', async () => {
    const read = vi.fn(() => null);
    const trigger = vi.fn<ResourceTrigger>();
    env.defineResource('weeklyPicks', { read, on: [trigger] });
    env.session.receive({ subscribe: ['weeklyPicks'] });
    await settle();

    trigger.mock.calls[0]?.[0]();
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
  });
});
