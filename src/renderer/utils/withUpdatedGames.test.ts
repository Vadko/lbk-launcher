import { describe, expect, it } from 'vitest';
import type { Game } from '../../shared/types';
import { withUpdatedGames } from './withUpdatedGames';

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
