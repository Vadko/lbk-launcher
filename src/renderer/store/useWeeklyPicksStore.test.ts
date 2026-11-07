import { beforeEach, describe, expect, it } from 'vitest';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { useWeeklyPicksStore } from './useWeeklyPicksStore';

const picks: WeeklyPicks = { title: 'Halloween', games: [] };

beforeEach(() => {
  useWeeklyPicksStore.setState({ picks: undefined });
});

describe('useWeeklyPicksStore', () => {
  it('keeps the set already shown when a read fails', () => {
    useWeeklyPicksStore.getState().setPicks(picks);

    useWeeklyPicksStore.getState().failRead();

    expect(useWeeklyPicksStore.getState().picks).toBe(picks);
  });

  it('stops loading when the first read fails', () => {
    useWeeklyPicksStore.getState().failRead();

    expect(useWeeklyPicksStore.getState().picks).toBeNull();
  });
});
