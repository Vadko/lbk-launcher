import { describe, expect, it, vi } from 'vitest';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';

type Handler = (event: unknown, hideAi: boolean) => unknown;

const state = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  getWeeklyPicks: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => state.handlers.set(channel, handler),
  },
}));
vi.mock('@/main/db/weekly-picks', () => ({ getWeeklyPicks: state.getWeeklyPicks }));

const { setupWeeklyPicksHandlers } = await import('./weekly-picks');
setupWeeklyPicksHandlers();

const picks: WeeklyPicks = { title: 'Halloween', games: [] };

describe('get-weekly-picks', () => {
  it.each([
    ['a set', () => picks, { picks }],
    ['no set', () => null, { picks: null }],
    [
      'a failed read',
      () => {
        throw new Error('SQLITE_BUSY');
      },
      null,
    ],
  ])('answers %s without throwing', (_, read, expected) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.getWeeklyPicks.mockImplementation(read);

    expect(state.handlers.get('get-weekly-picks')?.(null, true)).toEqual(expected);
    expect(state.getWeeklyPicks).toHaveBeenCalledWith(true);
  });
});
