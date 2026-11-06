import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastMessage } from './supabase-realtime';

const state = vi.hoisted(() => ({
  db: undefined as DatabaseSync | undefined,
  pages: [] as unknown[][],
  sent: vi.fn(),
}));

function sqlite(): DatabaseSync {
  if (!state.db) {
    throw new Error('The test database is not open');
  }
  return state.db;
}

vi.mock('@/main/db/database', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => sqlite().prepare(sql),
    transaction:
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A): R =>
        fn(...args),
  }),
}));
vi.mock('@/main/db/sync-metadata', () => ({
  getSyncMetadata: () => null,
  setSyncMetadata: vi.fn(),
}));
vi.mock('@/main/db/games-repository', () => ({
  GamesRepository: { getInstance: () => ({ getGamesByIds: (ids: string[]) => ids }) },
}));
vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({
    rpc: () => {
      const builder = {
        gt: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: state.pages.shift() ?? [], error: null }),
      };
      return builder;
    },
  }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => null }));
vi.mock('@/main/window', () => ({ sendToRenderer: state.sent }));

const { syncGameCounters, createGameCountersSubscription } = await import(
  './game-counters'
);

const counters = () =>
  sqlite()
    .prepare(
      'SELECT id, likes, downloads, subscriptions, reviews, error_reviews FROM games'
    )
    .all();

function broadcast(payload: unknown): void {
  const subscription = createGameCountersSubscription();
  const message: BroadcastMessage = { event: 'counters', type: 'broadcast', payload };
  subscription?.handlers[0]?.handler(message);
}

beforeEach(() => {
  state.pages = [];
  state.sent.mockReset();
  state.db = new DatabaseSync(':memory:');
  sqlite().exec(`
    CREATE TABLE games (
      id TEXT PRIMARY KEY,
      likes INTEGER NOT NULL DEFAULT 0,
      downloads INTEGER,
      subscriptions INTEGER,
      reviews INTEGER NOT NULL DEFAULT 0,
      error_reviews INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE my_likes (
      game_id TEXT PRIMARY KEY,
      liked INTEGER NOT NULL,
      server_liked INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO games (id) VALUES ('game-1'), ('game-2');
  `);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('syncGameCounters', () => {
  it('stores the review counts of every fetched row', async () => {
    state.pages = [
      [
        {
          game_id: 'game-1',
          likes: 2,
          downloads: 10,
          subscriptions: 1,
          reviews: 4,
          error_reviews: 1,
          touched_at: '2026-11-01T10:00:00Z',
        },
      ],
    ];

    await syncGameCounters();

    expect(counters()).toEqual([
      {
        id: 'game-1',
        likes: 2,
        downloads: 10,
        subscriptions: 1,
        reviews: 4,
        error_reviews: 1,
      },
      {
        id: 'game-2',
        likes: 0,
        downloads: null,
        subscriptions: null,
        reviews: 0,
        error_reviews: 0,
      },
    ]);
    expect(state.sent).toHaveBeenCalledWith('game-counters-updated', ['game-1']);
  });
});

describe('the counters broadcast', () => {
  it('listens on the private topic, which only the server can send on', () => {
    expect(createGameCountersSubscription()).toMatchObject({
      topic: 'game-counters',
      private: true,
    });
  });

  it('updates a game whose review counts alone changed', () => {
    broadcast({ counters: [['game-2', 0, null, null, 3, 1]] });

    expect(counters()[1]).toEqual({
      id: 'game-2',
      likes: 0,
      downloads: null,
      subscriptions: null,
      reviews: 3,
      error_reviews: 1,
    });
    expect(state.sent).toHaveBeenCalledWith('game-counters-updated', ['game-2']);
  });

  it('sends nothing when no counter changed', () => {
    broadcast({ counters: [['game-1', 0, null, null, 0, 0]] });

    expect(state.sent).not.toHaveBeenCalled();
  });

  it('updates a game whose error reviews count alone changed', () => {
    broadcast({ counters: [['game-1', 0, null, null, 0, 2]] });

    expect(counters()[0]).toMatchObject({ reviews: 0, error_reviews: 2 });
    expect(state.sent).toHaveBeenCalledWith('game-counters-updated', ['game-1']);
  });

  it('ignores a tuple of an older shape', () => {
    broadcast({ counters: [['game-1', 5, 1, 1, 3]] });

    expect(counters()[0]).toMatchObject({ likes: 0, reviews: 0, error_reviews: 0 });
    expect(state.sent).not.toHaveBeenCalled();
  });
});
