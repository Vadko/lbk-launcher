import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../../shared/types';
import type { WeeklyPicks, WeeklyPicksRead } from '../../shared/weekly-picks-types';
import { fakeElectronApi } from './bridgeApi.fixture';

vi.mock('./useStore', async () => {
  const { create } = await import('zustand');
  return { useStore: create(() => ({ syncStatus: 'ready' })) };
});
vi.mock('./useSettingsStore', async () => {
  const { create } = await import('zustand');
  return { useSettingsStore: create(() => ({ hideAiTranslations: false })) };
});

const game = (id: string, likes: number) => ({ id, likes }) as Game;
const picks: WeeklyPicks = { title: 'Halloween', games: [game('a', 1), game('b', 2)] };

const getWeeklyPicks = vi.fn<() => Promise<WeeklyPicksRead | null>>(() =>
  Promise.resolve({ picks })
);
const { api, emit } = fakeElectronApi({ getWeeklyPicks });
vi.stubGlobal('window', { electronAPI: api });
vi.useFakeTimers();

const { useWeeklyPicksStore } = await import('./useWeeklyPicksStore');
const { initWeeklyPicks } = await import('./weeklyPicksBridge');
initWeeklyPicks();

beforeEach(async () => {
  getWeeklyPicks.mockResolvedValue({ picks });
  emit('onWeeklyPicksUpdated');
  await vi.advanceTimersByTimeAsync(300);
  getWeeklyPicks.mockClear();
});

describe('initWeeklyPicks', () => {
  it('keeps the set already shown when a read fails', async () => {
    getWeeklyPicks.mockResolvedValue(null);
    emit('onWeeklyPicksUpdated');
    await vi.advanceTimersByTimeAsync(300);

    expect(getWeeklyPicks).toHaveBeenCalledOnce();
    expect(useWeeklyPicksStore.getState().picks).toBe(picks);
  });

  it('patches pushed counters into the shown games without a read', async () => {
    emit('onGameCountersUpdated', [game('b', 7), game('z', 3)]);
    await vi.advanceTimersByTimeAsync(300);

    expect(useWeeklyPicksStore.getState().picks).toEqual({
      title: 'Halloween',
      games: [game('a', 1), game('b', 7)],
    });
    expect(getWeeklyPicks).not.toHaveBeenCalled();
  });
});
