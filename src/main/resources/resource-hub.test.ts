import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceKey } from '@/shared/resources';

async function load() {
  vi.resetModules();
  const hub = await import('./resource-hub');
  const { appEvents } = await import('@/main/app-events');
  const wanted: ResourceKey[] = [];
  appEvents.on('resource-wanted', (key) => wanted.push(key));
  return { ...hub, wanted };
}

const sink = () => ({ post: vi.fn(), close: vi.fn() });

let env: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  env = await load();
});

describe('resource hub', () => {
  it('sends a value only to a page that subscribed to its key', () => {
    const page = sink();
    const session = env.openResourceSession(page);
    session.receive({ subscribe: ['likedGameIds'] });

    env.publishResource('likedGameIds', new Set(['a']));
    env.publishResource('weeklyPicks', null);

    expect(page.post.mock.calls).toEqual([
      [{ values: { likedGameIds: new Set(['a']) }, failed: [] }],
    ]);
  });

  it('drops a value equal to the last one', () => {
    const page = sink();
    env.openResourceSession(page).receive({ subscribe: ['likedGameIds'] });

    env.publishResource('likedGameIds', new Set(['a']));
    env.publishResource('likedGameIds', new Set(['a']));

    expect(page.post).toHaveBeenCalledTimes(1);
  });

  it('hands a key published before the subscribe over in the snapshot', () => {
    const page = sink();
    const session = env.openResourceSession(page);
    env.publishResource('weeklyPicks', null);
    env.failResource('ratings');

    session.receive({ subscribe: ['weeklyPicks', 'ratings', 'facetRows'] });

    expect(page.post.mock.calls).toEqual([
      [{ values: { weeklyPicks: null }, failed: ['ratings'] }],
    ]);
    expect(env.wanted).toEqual(['weeklyPicks', 'ratings', 'facetRows']);
  });

  it('reports a failure once and clears it with the next value, even an equal one', () => {
    const page = sink();
    env.openResourceSession(page).receive({ subscribe: ['weeklyPicks'] });
    env.publishResource('weeklyPicks', null);
    page.post.mockClear();

    env.failResource('weeklyPicks');
    env.failResource('weeklyPicks');
    env.publishResource('weeklyPicks', null);

    expect(page.post.mock.calls).toEqual([
      [{ values: {}, failed: ['weeklyPicks'] }],
      [{ values: { weeklyPicks: null }, failed: [] }],
    ]);
  });

  it('asks for each key once however often the page subscribes to it', () => {
    const session = env.openResourceSession(sink());

    session.receive({ subscribe: ['ratings'] });
    session.receive({ subscribe: ['ratings', 'facetRows'] });

    expect(env.wanted).toEqual(['ratings', 'facetRows']);
  });

  it('closes the previous page and forgets what it wanted', () => {
    const first = sink();
    const old = env.openResourceSession(first);
    old.receive({ subscribe: ['likedGameIds'] });
    const second = sink();
    env.openResourceSession(second);

    old.receive({ subscribe: ['ratings'] });
    env.publishResource('likedGameIds', new Set());

    expect(first.close).toHaveBeenCalledOnce();
    expect(first.post).not.toHaveBeenCalled();
    expect(second.post).not.toHaveBeenCalled();
    expect(env.isResourceWanted('likedGameIds')).toBe(false);
    expect(env.wanted).toEqual(['likedGameIds']);
  });

  it('stops sending once the page is gone', () => {
    const page = sink();
    const session = env.openResourceSession(page);
    session.receive({ subscribe: ['likedGameIds'] });

    session.end();
    env.publishResource('likedGameIds', new Set(['a']));

    expect(page.post).not.toHaveBeenCalled();
    expect(env.getResource('likedGameIds')).toEqual(new Set(['a']));
  });

  it.each([
    ['null', null],
    ['a string', 'likedGameIds'],
    ['keys that are not a list', { subscribe: 'likedGameIds' }],
    ['an unknown key', { subscribe: ['nope'] }],
  ])('ignores a message with %s', (_label, data) => {
    const page = sink();

    env.openResourceSession(page).receive(data);

    expect(env.wanted).toEqual([]);
    expect(page.post).not.toHaveBeenCalled();
  });
});
