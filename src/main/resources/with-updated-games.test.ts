import { describe, expect, it } from 'vitest';
import type { Game } from '@/shared/types';
import {
  homeInstalledWithCounters,
  weeklyPicksWithCounters,
  withUpdatedGames,
} from './with-updated-games';

const game = (id: string, likes = 0) => ({ id, likes }) as Game;
const games = [game('a', 1), game('b', 2), game('c', 3)];

describe('withUpdatedGames', () => {
  it('replaces the pushed rows in place and leaves the order and the rest alone', () => {
    expect(withUpdatedGames(games, [game('c', 30), game('a', 10), game('z', 5)])).toEqual(
      [game('a', 10), game('b', 2), game('c', 30)]
    );
  });

  it.each([
    ['no pushed rows', []],
    ['only rows of other games', [game('z', 5)]],
  ])('keeps the same list for %s', (_, updated) => {
    expect(withUpdatedGames(games, updated)).toBe(games);
  });
});

describe('homeInstalledWithCounters', () => {
  const installed = { games, installedPathsCount: 4 };

  it('patches the installed games and keeps the folder count', () => {
    expect(homeInstalledWithCounters(installed, [game('b', 7)])).toEqual({
      games: [game('a', 1), game('b', 7), game('c', 3)],
      installedPathsCount: 4,
    });
  });

  it('keeps the same value for rows of other games', () => {
    expect(homeInstalledWithCounters(installed, [game('z', 5)])).toBe(installed);
  });
});

describe('weeklyPicksWithCounters', () => {
  const picks = { title: 'Halloween', games };

  it('patches the set in its own order and keeps the title', () => {
    expect(weeklyPicksWithCounters(picks, [game('c', 30), game('a', 10)])).toEqual({
      title: 'Halloween',
      games: [game('a', 10), game('b', 2), game('c', 30)],
    });
  });

  it.each([
    ['no set', null],
    ['a set without the pushed games', picks],
  ])('keeps the same value for %s', (_, value) => {
    expect(weeklyPicksWithCounters(value, [game('z', 5)])).toBe(value);
  });
});
