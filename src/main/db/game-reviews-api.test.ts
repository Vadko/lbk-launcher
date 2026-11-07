import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answered, type Invoke, MACHINE_ID } from './review-functions.fixture';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn<Invoke>() }));

vi.mock('@/main/db/supabase-client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));
vi.mock('@/main/tracking', () => ({ IS_E2E: false, getMachineId: () => 'machine-1' }));
vi.mock('electron', () => ({ app: { getVersion: () => '2.24.0' } }));

const { fetchGameReviews } = await import('./game-reviews-api');

const GAME = '0b6f3f0e-5c1a-4d2e-9f3b-2a1c4d5e6f70';
const FOCUS = '3d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
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

  it('asks reviews?action=list with the cursor, this version and this machine', async () => {
    invoke.mockResolvedValue(page([]));

    await fetchGameReviews({ gameId: GAME, cursor: 'c|id' });

    expect(invoke.mock.calls).toEqual([
      [
        'reviews?action=list',
        {
          body: {
            gameId: GAME,
            cursor: 'c|id',
            version: '2.24.0',
            machineId: MACHINE_ID,
          },
          timeout: 15_000,
        },
      ],
    ]);
  });

  it('asks for the focus thread with the first page', async () => {
    invoke.mockResolvedValue(page([]));

    await fetchGameReviews({ gameId: GAME, cursor: null, focusId: FOCUS });

    expect(invoke.mock.calls.map(([, { body }]) => body)).toEqual([
      {
        gameId: GAME,
        cursor: null,
        focusId: FOCUS,
        version: '2.24.0',
        machineId: MACHINE_ID,
      },
    ]);
  });

  it('narrows the list to one type when asked', async () => {
    invoke.mockResolvedValue(page([]));

    await fetchGameReviews({ gameId: GAME, cursor: null, type: 'error' });

    expect(invoke.mock.calls.map(([, { body }]) => body)).toEqual([
      {
        gameId: GAME,
        cursor: null,
        type: 'error',
        version: '2.24.0',
        machineId: MACHINE_ID,
      },
    ]);
  });

  it('puts the focus thread first when the page does not hold it', async () => {
    invoke.mockResolvedValue(
      answered({
        items: [thread('a')],
        total: 30,
        nextCursor: `${CREATED}|a`,
        focus: thread('z'),
        viewer: null,
      })
    );

    const result = await fetchGameReviews({ gameId: GAME, cursor: null, focusId: FOCUS });

    expect(result).toEqual({
      ok: true,
      data: {
        items: [thread('z'), thread('a')],
        total: 30,
        nextCursor: `${CREATED}|a`,
        viewer: null,
      },
    });
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

  it.each([
    ['a thread', [thread('a'), thread('b', { type: 'unknown' })], null],
    [
      'a reply',
      [
        thread('a', {
          replies: [{ ...entry('r'), parentId: null, createdAt: 'yesterday' }],
        }),
      ],
      null,
    ],
    ['the focus thread', [thread('a')], thread('z', { moderation: 'removed' })],
  ])('fails the page when %s is malformed', async (_case, items, focus) => {
    invoke.mockResolvedValue(
      answered({ items, total: items.length, nextCursor: null, focus, viewer: null })
    );

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
