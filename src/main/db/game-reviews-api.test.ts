import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answered, invokeCalls, MACHINE_ID } from './review-functions.fixture';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => 'machine-1' }));

const { fetchGameReviews } = await import('./game-reviews-api');

const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
// to_jsonb(timestamptz) keeps microseconds and an offset
const CREATED = '2026-10-22T10:00:00.123456+00:00';

const entry = (id: string) => ({
  id,
  text: `text ${id}`,
  createdAt: CREATED,
  editedAt: null,
  author: { role: 'player', name: `name ${id}`, avatarSeed: `seed${id}`, isMine: false },
  moderation: 'published',
  pendingText: null,
});

const thread = (id: string, extra: Record<string, unknown> = {}) => ({
  ...entry(id),
  type: 'feedback',
  isPublic: true,
  screenshots: [],
  replies: [],
  ...extra,
});

const page = (items: unknown[]) =>
  answered({ items, total: items.length, nextCursor: null, focus: null, viewer: null });

const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('fetchGameReviews', () => {
  beforeEach(() => {
    invoke.mockReset();
    error.mockClear();
  });

  it('asks reviews?action=list with the cursor and this machine', async () => {
    invoke.mockResolvedValue(page([]));

    await fetchGameReviews({ gameId: GAME, cursor: 'c|id' });

    expect(invokeCalls(invoke.mock.calls)).toEqual([
      {
        name: 'reviews?action=list',
        body: { gameId: GAME, cursor: 'c|id', machineId: MACHINE_ID },
        timeout: 15_000,
      },
    ]);
  });

  it('reads the server page with screenshots, the viewer and removed stubs', async () => {
    const stub = { id: 'gone', parentId: null, createdAt: CREATED, removed: true };
    const reply = { ...entry('r'), parentId: 'gone' };
    invoke.mockResolvedValue(
      answered({
        items: [
          thread('a', { screenshots: ['https://signed/a.png'], replies: [stub, reply] }),
        ],
        total: 7,
        nextCursor: `${CREATED}|a`,
        focus: null,
        viewer: { name: 'Quiet Owl', avatarSeed: 'abcdef123456' },
      })
    );

    expect(await fetchGameReviews({ gameId: GAME, cursor: null })).toEqual({
      ok: true,
      data: {
        items: [
          thread('a', { screenshots: ['https://signed/a.png'], replies: [stub, reply] }),
        ],
        total: 7,
        nextCursor: `${CREATED}|a`,
        viewer: { name: 'Quiet Owl', avatarSeed: 'abcdef123456' },
      },
    });
  });

  it('drops a malformed thread or reply and keeps the rest of the page', async () => {
    invoke.mockResolvedValue(
      page([
        thread('a', {
          replies: [
            { ...entry('ok'), parentId: null },
            { ...entry('bad'), parentId: null, createdAt: 'yesterday' },
          ],
        }),
        thread('b', { type: 'unknown' }),
        thread('c', { moderation: 'removed' }),
      ])
    );

    const result = await fetchGameReviews({ gameId: GAME, cursor: null });

    expect(result.ok && result.data.items.map((item) => item.id)).toEqual(['a']);
    expect(result.ok && result.data.items[0]?.replies.map((item) => item.id)).toEqual([
      'ok',
    ]);
    // console.error is what reaches Sentry, so a contract break is seen
    expect(error.mock.calls.map(([message]) => message)).toEqual([
      '[Reviews] Dropped 1 of 2 replies:',
      '[Reviews] Dropped 2 of 3 threads:',
    ]);
    expect(String(error.mock.calls[0]?.[1])).toContain('createdAt');
  });

  it('fails the page when every thread is malformed', async () => {
    invoke.mockResolvedValue(page([thread('a', { type: 'unknown' })]));

    expect(await fetchGameReviews({ gameId: GAME, cursor: null })).toEqual({
      ok: false,
      failure: { code: 'bad_response', kind: 'retry' },
    });
  });

  it('reads an empty page as a game without reviews', async () => {
    invoke.mockResolvedValue(page([]));

    const result = await fetchGameReviews({ gameId: GAME, cursor: null });

    expect(result.ok && result.data.items).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  it('fails the page when its frame is malformed', async () => {
    invoke.mockResolvedValue(answered({ items: [], total: 'many' }));

    expect(await fetchGameReviews({ gameId: GAME, cursor: null })).toEqual({
      ok: false,
      failure: { code: 'bad_response', kind: 'retry' },
    });
  });
});
