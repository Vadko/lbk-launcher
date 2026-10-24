import { describe, expect, it } from 'vitest';
import type { Game } from '../../shared/types';
import { orderWeeklyPickGames } from './weeklyPicks';

const game = (id: string) => ({ id }) as Game;

describe('orderWeeklyPickGames', () => {
  it.each([
    [
      'keeps the server order, not the catalog order',
      ['b', 'a', 'c'],
      ['a', 'b', 'c'],
      ['b', 'a', 'c'],
    ],
    ['drops ids missing from the local catalog', ['a', 'x', 'c'], ['a', 'c'], ['a', 'c']],
    ['drops a duplicated id', ['a', 'a', 'b'], ['a', 'b'], ['a', 'b']],
    ['ignores local games the set does not name', ['a'], ['a', 'z'], ['a']],
    ['gives nothing for an empty set', [], ['a'], []],
    ['gives nothing while no game is local yet', ['a', 'b'], [], []],
  ])('%s', (_label, ids, local, expected) => {
    expect(orderWeeklyPickGames(ids, local.map(game)).map((item) => item.id)).toEqual(
      expected
    );
  });
});
