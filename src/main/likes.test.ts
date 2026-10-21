import { DatabaseSync } from 'node:sqlite';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  machineId: 'machine-1' as string | null,
  invoke: vi.fn(),
  db: undefined as DatabaseSync | undefined,
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
      (...args: A): R => {
        sqlite().exec('BEGIN');
        try {
          const result = fn(...args);
          sqlite().exec('COMMIT');
          return result;
        } catch (error) {
          sqlite().exec('ROLLBACK');
          throw error;
        }
      },
  }),
}));
vi.mock('@/main/db/games-repository', () => ({
  GamesRepository: { getInstance: () => ({ getGamesByIds: () => [] }) },
}));
vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke: state.invoke } }),
}));
vi.mock('@/main/tracking', () => ({
  IS_E2E: false,
  getMachineId: () => state.machineId,
}));
vi.mock('@/main/window', () => ({ sendToRenderer: vi.fn() }));

const { setLike, syncLikes } = await import('./likes');

const GAME = 'game-1';

const httpError = (status: number) => ({
  data: null,
  error: new FunctionsHttpError(new Response(null, { status })),
});
const confirmed = (likes: number) => ({ data: { success: true, likes }, error: null });

function seed(likes: number, row?: { liked: 0 | 1; server_liked: 0 | 1 }): void {
  sqlite().prepare('INSERT INTO games (id, likes) VALUES (?, ?)').run(GAME, likes);
  if (row) {
    sqlite()
      .prepare('INSERT INTO my_likes (game_id, liked, server_liked) VALUES (?, ?, ?)')
      .run(GAME, row.liked, row.server_liked);
  }
}

const snapshot = () => ({
  likes: (sqlite().prepare('SELECT likes FROM games').get() as { likes: number }).likes,
  rows: sqlite().prepare('SELECT game_id, liked, server_liked FROM my_likes').all(),
});

const sentActions = () =>
  state.invoke.mock.calls.map(
    ([, options]) => (options as { body: { action?: string } }).body.action
  );

beforeEach(() => {
  vi.useFakeTimers();
  state.machineId = 'machine-1';
  state.invoke.mockReset();
  state.db = new DatabaseSync(':memory:');
  sqlite().exec(`
    CREATE TABLE games (id TEXT PRIMARY KEY, likes INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE my_likes (
      game_id TEXT PRIMARY KEY,
      liked INTEGER NOT NULL,
      server_liked INTEGER NOT NULL DEFAULT 0
    );
  `);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  // Drains the module's retry timer so it does not leak into the next test
  state.invoke.mockResolvedValue(confirmed(0));
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
});

describe('setLike', () => {
  it('counts the like at once and settles on the server count', async () => {
    seed(4);
    state.invoke.mockResolvedValue(confirmed(7));

    setLike(GAME, true);
    expect(snapshot()).toEqual({
      likes: 5,
      rows: [{ game_id: GAME, liked: 1, server_liked: 0 }],
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(sentActions()).toEqual(['like']);
    expect(snapshot()).toEqual({
      likes: 7,
      rows: [{ game_id: GAME, liked: 1, server_liked: 1 }],
    });
  });

  it('sends nothing when the debounce folds the toggles back to the server state', async () => {
    seed(3, { liked: 1, server_liked: 1 });

    setLike(GAME, false);
    setLike(GAME, true);
    await vi.advanceTimersByTimeAsync(400);

    expect(state.invoke).not.toHaveBeenCalled();
    expect(snapshot()).toEqual({
      likes: 3,
      rows: [{ game_id: GAME, liked: 1, server_liked: 1 }],
    });
  });

  it('reverts a rejected unlike to the like the server holds', async () => {
    seed(3, { liked: 1, server_liked: 1 });
    state.invoke.mockResolvedValue(httpError(429));

    setLike(GAME, false);
    expect(snapshot().likes).toBe(2);
    await vi.advanceTimersByTimeAsync(400);

    expect(snapshot()).toEqual({
      likes: 3,
      rows: [{ game_id: GAME, liked: 1, server_liked: 1 }],
    });
  });

  it('drops a rejected like', async () => {
    seed(3);
    state.invoke.mockResolvedValue(httpError(404));

    setLike(GAME, true);
    await vi.advanceTimersByTimeAsync(400);

    expect(snapshot()).toEqual({ likes: 3, rows: [] });
  });

  it('rejects without a machine id instead of retrying forever', async () => {
    seed(3);
    state.machineId = null;

    setLike(GAME, true);
    await vi.advanceTimersByTimeAsync(400);

    expect(state.invoke).not.toHaveBeenCalled();
    expect(snapshot()).toEqual({ likes: 3, rows: [] });
  });

  it('keeps an unreachable like and retries it a minute later', async () => {
    seed(3);
    state.invoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsFetchError('offline'),
    });
    state.invoke.mockResolvedValueOnce(httpError(503));
    state.invoke.mockResolvedValueOnce(confirmed(4));

    setLike(GAME, true);
    await vi.advanceTimersByTimeAsync(400);
    expect(snapshot()).toEqual({
      likes: 4,
      rows: [{ game_id: GAME, liked: 1, server_liked: 0 }],
    });

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sentActions()).toEqual(['like', 'like', 'like']);
    expect(snapshot()).toEqual({
      likes: 4,
      rows: [{ game_id: GAME, liked: 1, server_liked: 1 }],
    });
  });

  it('keeps a click made during the request on top of the confirmed count', async () => {
    seed(3);
    const reply = { send: (_value: ReturnType<typeof confirmed>): void => undefined };
    state.invoke
      .mockReturnValueOnce(
        new Promise((resolve) => {
          reply.send = resolve;
        })
      )
      .mockResolvedValueOnce(confirmed(3));

    setLike(GAME, true);
    await vi.advanceTimersByTimeAsync(400);
    setLike(GAME, false);
    reply.send(confirmed(4));
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshot()).toEqual({
      likes: 3,
      rows: [{ game_id: GAME, liked: 0, server_liked: 1 }],
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(sentActions()).toEqual(['like', 'unlike']);
    expect(snapshot()).toEqual({ likes: 3, rows: [] });
  });
});

describe('syncLikes', () => {
  it('takes the server list but keeps likes that are not sent yet', async () => {
    seed(0, { liked: 1, server_liked: 1 });
    sqlite()
      .prepare('INSERT INTO my_likes (game_id, liked, server_liked) VALUES (?, 1, 0)')
      .run('pending');
    state.invoke.mockImplementation(
      (_name: string, options: { body: { type: string } }) =>
        Promise.resolve(
          options.body.type === 'liked_games'
            ? { data: { success: true, gameIds: ['other'] }, error: null }
            : { data: null, error: new FunctionsFetchError('offline') }
        )
    );

    await syncLikes();

    expect(snapshot().rows).toEqual([
      { game_id: 'pending', liked: 1, server_liked: 0 },
      { game_id: 'other', liked: 1, server_liked: 1 },
    ]);
  });
});
