import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase-client', () => ({ getSupabaseClient: () => ({ rpc }) }));

const { fetchWeeklyPicks } = await import('./weekly-picks-api');

const row = {
  title: 'Halloween',
  starts_at: '2026-10-23T10:00:00Z',
  expires_at: '2026-10-30T10:00:00Z',
  game_ids: ['g1', 'g2', 'g3'],
};

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('fetchWeeklyPicks', () => {
  it('maps the current set', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });

    await expect(fetchWeeklyPicks()).resolves.toEqual({
      title: 'Halloween',
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      gameIds: row.game_ids,
    });
    expect(rpc).toHaveBeenCalledWith('get_home_picks');
  });

  it('keeps a missing title as null', async () => {
    rpc.mockResolvedValue({ data: [{ ...row, title: null }], error: null });

    await expect(fetchWeeklyPicks()).resolves.toMatchObject({ title: null });
  });

  it.each([
    ['no rows', { data: [], error: null }],
    ['null data', { data: null, error: null }],
    ['a set without games', { data: [{ ...row, game_ids: [] }], error: null }],
    ['an rpc error', { data: null, error: { message: 'boom' } }],
  ])('returns null for %s', async (_label, response) => {
    rpc.mockResolvedValue(response);

    await expect(fetchWeeklyPicks()).resolves.toBeNull();
  });
});
