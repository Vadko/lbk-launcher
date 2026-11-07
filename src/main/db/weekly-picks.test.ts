import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../shared/types';
import type { BroadcastMessage } from './supabase-realtime';

interface SetRow {
  title: string | null;
  starts_at: string;
  expires_at: string;
  game_ids: string[];
}

const state = vi.hoisted(() => ({
  db: undefined as DatabaseSync | undefined,
  rpc: { data: [] as SetRow[] | null, error: null as Error | null },
  metadata: new Map<string, string>(),
  localIds: [] as string[],
  repositoryCalls: [] as { ids: string[]; hideAi: boolean }[],
  changed: vi.fn(),
}));

function sqlite(): DatabaseSync {
  if (!state.db) {
    throw new Error('The test database is not open');
  }
  return state.db;
}

vi.mock('@/main/db/database', () => ({
  getDatabase: () => ({ prepare: (sql: string) => sqlite().prepare(sql) }),
}));
vi.mock('@/main/db/sync-metadata', () => ({
  getSyncMetadata: (key: string) => state.metadata.get(key) ?? null,
  setSyncMetadata: (key: string, value: string) => state.metadata.set(key, value),
}));
vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ rpc: () => Promise.resolve(state.rpc) }),
}));
vi.mock('@/main/db/games-repository', () => ({
  GamesRepository: {
    getInstance: () => ({
      // The catalog answers in its own order and leaves out games it does not show
      getGamesByIds: (ids: string[], _search: undefined, hideAi: boolean) => {
        state.repositoryCalls.push({ ids, hideAi });
        return state.localIds
          .filter((id) => ids.includes(id))
          .map((id) => ({ id }) as Game);
      },
    }),
  },
}));

const { createWeeklyPicksSubscription, getWeeklyPicks, syncWeeklyPicks } = await import(
  './weekly-picks'
);
const { appEvents } = await import('@/main/app-events');
appEvents.on('weekly-picks-changed', state.changed);

const setRow = (
  gameIds: string[],
  startsAt = '2026-11-02T10:00:00.123456+00:00',
  title: string | null = 'Halloween'
): SetRow => ({
  title,
  starts_at: startsAt,
  expires_at: '2026-11-09T10:00:00+00:00',
  game_ids: gameIds,
});

function broadcast(payload: unknown): void {
  const message: BroadcastMessage = { event: 'set', type: 'broadcast', payload };
  createWeeklyPicksSubscription()?.handlers[0]?.handler(message);
}

const shownIds = (hideAi = false) => getWeeklyPicks(hideAi)?.games.map((game) => game.id);

beforeEach(() => {
  state.rpc = { data: [], error: null };
  state.metadata.clear();
  state.localIds = ['a', 'b', 'c', 'd', 'e', 'f'];
  state.repositoryCalls = [];
  state.changed.mockReset();
  state.db = new DatabaseSync(':memory:');
  sqlite().exec(`
    CREATE TABLE weekly_picks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT,
      starts_at INTEGER NOT NULL,
      game_ids TEXT NOT NULL
    );
  `);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('syncWeeklyPicks', () => {
  it('stores the current set and notifies once', async () => {
    state.rpc.data = [setRow(['c', 'a', 'b'])];

    await syncWeeklyPicks();

    expect(getWeeklyPicks(false)?.title).toBe('Halloween');
    expect(shownIds()).toEqual(['c', 'a', 'b']);
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored set and stays quiet when the server has none or fails', async () => {
    state.rpc.data = [setRow(['a', 'b', 'c'])];
    await syncWeeklyPicks();
    state.changed.mockReset();

    state.rpc.data = [];
    await syncWeeklyPicks();
    state.rpc = { data: null, error: new Error('offline') };
    await syncWeeklyPicks();

    expect(shownIds()).toEqual(['a', 'b', 'c']);
    expect(state.changed).not.toHaveBeenCalled();
  });

  it('does not notify when the same set comes back unchanged', async () => {
    state.rpc.data = [setRow(['a', 'b', 'c'])];
    await syncWeeklyPicks();
    state.changed.mockReset();

    await syncWeeklyPicks();

    expect(state.changed).not.toHaveBeenCalled();
  });

  it('takes the same set with fewer games, as a deleted game cascades out of it', async () => {
    state.rpc.data = [setRow(['a', 'b', 'c'])];
    await syncWeeklyPicks();

    state.rpc.data = [setRow(['a', 'c'])];
    await syncWeeklyPicks();

    expect(shownIds()).toEqual(['a', 'c']);
  });

  it('keeps a set left without games, so the section hides', async () => {
    state.rpc.data = [setRow([])];

    await syncWeeklyPicks();

    expect(getWeeklyPicks(false)).toEqual({ title: 'Halloween', games: [] });
  });
});

describe('the home-picks broadcast', () => {
  it('listens on the private topic, which only the server can send on', () => {
    expect(createWeeklyPicksSubscription()).toMatchObject({
      topic: 'home-picks',
      private: true,
    });
  });

  it('replaces the stored set with a newer one, ignoring extra payload keys', async () => {
    state.rpc.data = [setRow(['a', 'b', 'c'])];
    await syncWeeklyPicks();
    state.changed.mockReset();

    broadcast({
      ...setRow(['d', 'e', 'f'], '2026-11-03T08:00:00+00:00', null),
      id: 'message-id',
    });

    expect(getWeeklyPicks(false)?.title).toBeNull();
    expect(shownIds()).toEqual(['d', 'e', 'f']);
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it('never lets an older set replace a newer one', async () => {
    broadcast(setRow(['d', 'e', 'f'], '2026-11-03T08:00:00+00:00'));
    state.changed.mockReset();

    state.rpc.data = [setRow(['a', 'b', 'c'], '2026-11-02T10:00:00+00:00')];
    await syncWeeklyPicks();

    expect(shownIds()).toEqual(['d', 'e', 'f']);
    expect(state.changed).not.toHaveBeenCalled();
  });

  it('ignores a malformed payload', () => {
    broadcast({ title: 'Halloween', game_ids: 'a,b,c' });

    expect(getWeeklyPicks(false)).toBeNull();
    expect(state.changed).not.toHaveBeenCalled();
  });
});

describe('getWeeklyPicks', () => {
  it('has nothing before the first set arrives', () => {
    expect(getWeeklyPicks(false)).toBeNull();
  });

  it('reads the games from the catalog in the set order and drops those it does not show', async () => {
    state.localIds = ['a', 'c'];
    state.rpc.data = [setRow(['c', 'x', 'a'])];
    await syncWeeklyPicks();

    expect(shownIds(true)).toEqual(['c', 'a']);
    expect(state.repositoryCalls.at(-1)).toEqual({ ids: ['c', 'x', 'a'], hideAi: true });
  });
});
