import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceKey, ResourceUpdate } from '@/shared/resources';
import type { Game } from '@/shared/types';
import type { WeeklyPicks } from '@/shared/weekly-picks-types';
import { sink } from './resource-sink.fixture';

async function load() {
  vi.resetModules();
  const hub = await import('./resource-hub');
  const { appEvents } = await import('@/main/app-events');
  const wanted: ResourceKey[] = [];
  appEvents.on('resource-wanted', (key) => wanted.push(key));
  return { ...hub, wanted };
}

type Env = Awaited<ReturnType<typeof load>>;

const brokenSink = () => ({
  postMessage: vi.fn(() => {
    throw new Error('port closed');
  }),
  close: vi.fn(),
});

type BrokenSink = ReturnType<typeof brokenSink>;

const ids = (...list: string[]) => new Set(list);
const game = (id: string, likes: number) => ({ id, likes }) as Game;
const picks = (...games: Game[]): WeeklyPicks => ({ title: null, games });

let env: Env;

beforeEach(async () => {
  env = await load();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('subscribe', () => {
  it('asks for every key of every subscribe, the same key again included', () => {
    const session = env.openResourceSession(sink());

    session.receive({ subscribe: ['ratings', 'facetRows'] });
    session.receive({ subscribe: ['ratings'] });

    expect(env.wanted).toEqual(['ratings', 'facetRows', 'ratings']);
  });
});

describe('publishResource', () => {
  it('sends every value to the current page, subscribed to its key or not', () => {
    const page = sink();
    env.openResourceSession(page).receive({ subscribe: ['likedGameIds'] });

    env.publishResource('likedGameIds', ids('a'));
    env.publishResource('weeklyPicks', null);

    expect(page.sent).toEqual([
      { values: { likedGameIds: ids('a') }, failed: [] },
      { values: { weeklyPicks: null }, failed: [] },
    ]);
  });

  it('drops a value deep-equal to the last one and sends a changed one', () => {
    const page = sink();
    env.openResourceSession(page);

    env.publishResource('likedGameIds', ids('a'));
    env.publishResource('likedGameIds', ids('a'));
    env.publishResource('likedGameIds', ids('b'));

    expect(page.sent).toEqual([
      { values: { likedGameIds: ids('a') }, failed: [] },
      { values: { likedGameIds: ids('b') }, failed: [] },
    ]);
  });

  it('holds a value published while no page is open for the next page', () => {
    env.publishResource('likedGameIds', ids('a'));
    const page = sink();

    env.openResourceSession(page);

    expect(page.sent).toEqual([{ values: { likedGameIds: ids('a') }, failed: [] }]);
  });
});

describe('failResource', () => {
  it('reports a key once while it stays failed and keeps its last value', () => {
    const page = sink();
    env.openResourceSession(page);
    env.publishResource('weeklyPicks', picks(game('a', 1)));

    env.failResource('weeklyPicks');
    env.failResource('weeklyPicks');
    const next = sink();
    env.openResourceSession(next);

    expect(page.sent).toEqual([
      { values: { weeklyPicks: picks(game('a', 1)) }, failed: [] },
      { values: {}, failed: ['weeklyPicks'] },
    ]);
    expect(next.sent).toEqual([
      { values: { weeklyPicks: picks(game('a', 1)) }, failed: ['weeklyPicks'] },
    ]);
  });

  it.each([
    ['an equal value', picks(game('a', 1))],
    ['a changed value', picks(game('a', 2))],
  ])('clears a failure with %s, and only once', (_label, value) => {
    env.publishResource('weeklyPicks', picks(game('a', 1)));
    env.failResource('weeklyPicks');
    const page = sink();
    env.openResourceSession(page);

    env.publishResource('weeklyPicks', value);
    env.publishResource('weeklyPicks', value);

    expect(page.sent).toEqual([
      { values: { weeklyPicks: picks(game('a', 1)) }, failed: ['weeklyPicks'] },
      { values: { weeklyPicks: value }, failed: [] },
    ]);
  });
});

describe('the failed keys', () => {
  it('names every failed key in each update, so the page replaces its own list', () => {
    env.failResource('ratings');
    const page = sink();
    env.openResourceSession(page);

    env.publishResource('likedGameIds', ids('a'));
    env.failResource('weeklyPicks');
    env.publishResource('ratings', { teams: [], games: [] });

    expect(page.sent).toEqual([
      { values: {}, failed: ['ratings'] },
      { values: { likedGameIds: ids('a') }, failed: ['ratings'] },
      { values: {}, failed: ['ratings', 'weeklyPicks'] },
      { values: { ratings: { teams: [], games: [] } }, failed: ['weeklyPicks'] },
    ]);
  });
});

describe('patchResource', () => {
  it('sends the patched value', () => {
    const page = sink();
    env.openResourceSession(page);
    env.publishResource('weeklyPicks', picks(game('a', 1)));

    env.patchResource('weeklyPicks', () => picks(game('a', 9)));

    expect(page.sent).toEqual([
      { values: { weeklyPicks: picks(game('a', 1)) }, failed: [] },
      { values: { weeklyPicks: picks(game('a', 9)) }, failed: [] },
    ]);
  });

  it('sends nothing while no value is held', () => {
    const page = sink();
    env.openResourceSession(page);

    env.patchResource('weeklyPicks', () => picks(game('a', 9)));

    expect(page.sent).toEqual([]);
  });

  it('sends nothing when the patch returns the value it was given', () => {
    const page = sink();
    env.openResourceSession(page);
    env.publishResource('weeklyPicks', picks(game('a', 1)));

    env.patchResource('weeklyPicks', (value) => value);

    expect(page.sent).toHaveLength(1);
  });

  // The equal value after the patch goes out only because the key is still failed
  it('keeps a failed key failed, since a patch is not a read', () => {
    env.publishResource('weeklyPicks', picks(game('a', 1)));
    env.failResource('weeklyPicks');
    const page = sink();
    env.openResourceSession(page);

    env.patchResource('weeklyPicks', () => picks(game('a', 9)));
    env.publishResource('weeklyPicks', picks(game('a', 9)));

    expect(page.sent).toEqual([
      { values: { weeklyPicks: picks(game('a', 1)) }, failed: ['weeklyPicks'] },
      { values: { weeklyPicks: picks(game('a', 9)) }, failed: ['weeklyPicks'] },
      { values: { weeklyPicks: picks(game('a', 9)) }, failed: [] },
    ]);
  });
});

describe('openResourceSession', () => {
  it('sends a new page one snapshot of every held value and failed key', () => {
    env.publishResource('likedGameIds', ids('a'));
    env.publishResource('weeklyPicks', null);
    env.failResource('weeklyPicks');
    env.failResource('ratings');
    const page = sink();

    env.openResourceSession(page);

    expect(page.sent).toEqual([
      {
        values: { likedGameIds: ids('a'), weeklyPicks: null },
        failed: ['weeklyPicks', 'ratings'],
      },
    ]);
  });

  it('sends no snapshot while nothing is held', () => {
    const page = sink();

    env.openResourceSession(page);

    expect(page.sent).toEqual([]);
  });

  it('closes the previous page and sends later values to the newest only', () => {
    const first = sink();
    env.openResourceSession(first);
    const second = sink();
    env.openResourceSession(second);

    env.publishResource('likedGameIds', ids('a'));

    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
    expect(first.sent).toEqual([]);
    expect(second.sent).toEqual([{ values: { likedGameIds: ids('a') }, failed: [] }]);
  });

  it('keeps the newest page when an older session ends after it opened', () => {
    const old = env.openResourceSession(sink());
    const page = sink();
    env.openResourceSession(page);

    old.end();
    env.publishResource('likedGameIds', ids('a'));

    expect(page.sent).toEqual([{ values: { likedGameIds: ids('a') }, failed: [] }]);
  });

  it('posts nothing once the current session ends and hands the next page what came', () => {
    const page = sink();
    const session = env.openResourceSession(page);

    session.end();
    env.publishResource('likedGameIds', ids('a'));
    env.failResource('ratings');
    const next = sink();
    env.openResourceSession(next);

    expect(page.sent).toEqual([]);
    expect(next.sent).toEqual([
      { values: { likedGameIds: ids('a') }, failed: ['ratings'] },
    ]);
  });
});

describe('a page that cannot take a message', () => {
  it.each<[string, (hub: Env, broken: BrokenSink) => void, ResourceUpdate]>([
    [
      'the snapshot',
      (hub, broken) => hub.openResourceSession(broken),
      { values: { likedGameIds: ids('a') }, failed: [] },
    ],
    [
      'a published value',
      (hub, broken) => {
        hub.openResourceSession(broken);
        hub.publishResource('likedGameIds', ids('b'));
      },
      { values: { likedGameIds: ids('b') }, failed: [] },
    ],
    [
      'a patch',
      (hub, broken) => {
        hub.openResourceSession(broken);
        hub.patchResource('likedGameIds', () => ids('b'));
      },
      { values: { likedGameIds: ids('b') }, failed: [] },
    ],
    [
      'a failure',
      (hub, broken) => {
        hub.openResourceSession(broken);
        hub.failResource('likedGameIds');
      },
      { values: { likedGameIds: ids('a') }, failed: ['likedGameIds'] },
    ],
  ])(
    'logs %s it could not take, throws nothing and keeps the state',
    (_label, run, held) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      env.publishResource('likedGameIds', ids('a'));
      const broken = brokenSink();

      expect(() => run(env, broken)).not.toThrow();
      const next = sink();
      env.openResourceSession(next);

      expect(broken.postMessage).toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        '[Resources] Failed to publish:',
        expect.any(Error)
      );
      expect(next.sent).toEqual([held]);
    }
  );
});
