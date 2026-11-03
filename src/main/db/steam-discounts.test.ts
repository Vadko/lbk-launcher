import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastMessage } from './supabase-realtime';

interface FeedRow {
  steam_app_id: number;
  discount_percent: number;
  ends_at: string | null;
  touched_at: string;
}

const state = vi.hoisted(() => ({
  db: undefined as DatabaseSync | undefined,
  pages: [] as FeedRow[][],
  calls: [] as { since: string | undefined; after?: number }[],
  metadata: new Map<string, string>(),
  savedWatermarks: [] as string[],
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
  getSyncMetadata: (key: string) => state.metadata.get(key) ?? null,
  setSyncMetadata: (key: string, value: string) => {
    state.savedWatermarks.push(value);
    state.metadata.set(key, value);
  },
}));
vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({
    rpc: (_name: string, args: { p_since?: string }) => {
      const call: { since: string | undefined; after?: number } = {
        since: args.p_since,
      };
      state.calls.push(call);
      const builder = {
        gt: (_column: string, value: number) => {
          call.after = value;
          return builder;
        },
        order: () => builder,
        limit: () => Promise.resolve({ data: state.pages.shift() ?? [], error: null }),
      };
      return builder;
    },
  }),
}));
vi.mock('@/main/window', () => ({ sendToRenderer: state.sent }));

const { createSteamDiscountsSubscription, getActiveSteamDiscounts, syncSteamDiscounts } =
  await import('./steam-discounts');

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const stored = () =>
  sqlite()
    .prepare(
      'SELECT steam_app_id, discount_percent, ends_at FROM steam_discounts ORDER BY steam_app_id'
    )
    .all();

const feedRow = (
  steamAppId: number,
  percent: number,
  endsAt: string | null,
  touchedAt = '2026-11-03T10:00:00Z'
): FeedRow => ({
  steam_app_id: steamAppId,
  discount_percent: percent,
  ends_at: endsAt,
  touched_at: touchedAt,
});

function broadcast(payload: unknown): void {
  const subscription = createSteamDiscountsSubscription();
  const message: BroadcastMessage = { event: 'discounts', type: 'broadcast', payload };
  subscription?.handlers[0]?.handler(message);
}

function seed(steamAppId: number, percent: number, endsAt: number): void {
  sqlite()
    .prepare(
      'INSERT INTO steam_discounts (steam_app_id, discount_percent, ends_at) VALUES (?, ?, ?)'
    )
    .run(steamAppId, percent, endsAt);
}

beforeEach(() => {
  state.pages = [];
  state.calls = [];
  state.metadata.clear();
  state.savedWatermarks = [];
  state.sent.mockReset();
  state.db = new DatabaseSync(':memory:');
  sqlite().exec(`
    CREATE TABLE steam_discounts (
      steam_app_id INTEGER PRIMARY KEY,
      discount_percent INTEGER NOT NULL,
      ends_at INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('syncSteamDiscounts', () => {
  it('pages by app id and saves the newest touched_at once every page is applied', async () => {
    const ends = future(2);
    state.pages = [
      Array.from({ length: 1000 }, (_, index) =>
        feedRow(index + 1, 10, ends, index === 500 ? '2026-11-03T12:00:00Z' : undefined)
      ),
      [feedRow(5000, 20, ends, '2026-11-03T11:00:00Z')],
    ];

    await syncSteamDiscounts();

    expect(state.calls).toEqual([
      { since: undefined },
      { since: undefined, after: 1000 },
    ]);
    expect(stored()).toHaveLength(1001);
    expect(state.savedWatermarks).toEqual(['2026-11-03T12:00:00Z']);
  });

  it('asks from the stored watermark and keeps it when nothing newer arrives', async () => {
    state.metadata.set('steam_discounts_synced_at', '2026-11-03T09:00:00Z');

    await syncSteamDiscounts();

    expect(state.calls).toEqual([{ since: '2026-11-03T09:00:00Z' }]);
    expect(state.savedWatermarks).toEqual(['2026-11-03T09:00:00Z']);
    expect(state.sent).not.toHaveBeenCalled();
  });

  it('inserts, updates and deletes, and notifies once per changed batch', async () => {
    seed(10, 30, Date.parse(future(1)));
    seed(20, 50, Date.parse(future(1)));
    seed(30, 70, Date.parse(future(1)));
    seed(40, 90, Date.parse(future(1)));
    const ends = future(3);
    state.pages = [
      [
        feedRow(10, 40, ends),
        feedRow(20, 0, null),
        feedRow(30, 70, null),
        feedRow(40, 90, new Date(Date.now() - DAY).toISOString()),
        feedRow(50, 25, ends),
        feedRow(60, 0, null),
      ],
    ];

    await syncSteamDiscounts();

    expect(stored()).toEqual([
      { steam_app_id: 10, discount_percent: 40, ends_at: Date.parse(ends) },
      { steam_app_id: 50, discount_percent: 25, ends_at: Date.parse(ends) },
    ]);
    expect(state.sent.mock.calls).toEqual([['steam-discounts-updated']]);
  });

  it('sends nothing when every row is already stored as it is', async () => {
    const ends = future(3);
    seed(10, 40, Date.parse(ends));
    state.pages = [[feedRow(10, 40, ends), feedRow(20, 0, null)]];

    await syncSteamDiscounts();

    expect(state.sent).not.toHaveBeenCalled();
  });
});

describe('the discounts broadcast', () => {
  const endsAtSeconds = Math.floor(Date.now() / 1000) + 3600;

  it('stores a discount from a tuple with an extra field', () => {
    broadcast({ discounts: [[10, 35, endsAtSeconds, 'extra']] });

    expect(stored()).toEqual([
      { steam_app_id: 10, discount_percent: 35, ends_at: endsAtSeconds * 1000 },
    ]);
    expect(state.sent).toHaveBeenCalledWith('steam-discounts-updated');
  });

  it('deletes a discount whose end is null', () => {
    seed(10, 35, endsAtSeconds * 1000);

    broadcast({ discounts: [[10, 35, null]] });

    expect(stored()).toEqual([]);
    expect(state.sent).toHaveBeenCalledWith('steam-discounts-updated');
  });

  it('ignores a malformed batch', () => {
    broadcast({ discounts: [['10', 35, endsAtSeconds]] });

    expect(stored()).toEqual([]);
    expect(state.sent).not.toHaveBeenCalled();
  });
});

describe('getActiveSteamDiscounts', () => {
  it('drops discounts whose end has passed', () => {
    const ends = Date.now() + DAY;
    seed(10, 40, ends);
    seed(20, 60, Date.now() - 1000);

    expect(getActiveSteamDiscounts()).toEqual([
      { steamAppId: 10, percent: 40, endsAt: ends },
    ]);
  });
});
