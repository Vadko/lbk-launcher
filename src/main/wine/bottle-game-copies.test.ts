import { describe, expect, it, vi } from 'vitest';
import type { InstallPath } from '../../shared/types';
import { bottleGameCopies, findBottleGameCopy } from './bottle-game-copies';

const BOTTLE = { prefix: '/Bottles/a', launcher: 'crossover' as const, label: 'a' };
const OTHER = { prefix: '/Bottles/b', launcher: 'crossover' as const, label: 'b' };
const GAME_IN_A = '/Bottles/a/drive_c/Steam/steamapps/common/Game';

vi.mock('./bottle-steam-roots', () => ({
  bottleSteams: () => [
    { prefix: BOTTLE, steamPath: '/Bottles/a/drive_c/Steam' },
    { prefix: OTHER, steamPath: '/Bottles/b/drive_c/Steam' },
  ],
  findBottleSteamGame: (bottle: { prefix: { prefix: string } }) =>
    bottle.prefix.prefix === BOTTLE.prefix ? GAME_IN_A : null,
}));

const STEAM: InstallPath = { type: 'steam', path: 'Game' };
const GOG: InstallPath = { type: 'gog', path: 'Game' };

describe('bottleGameCopies', () => {
  it.each<[string, InstallPath[], number | null, string[]]>([
    ['a Steam entry, in the bottle that has it', [STEAM], null, [GAME_IN_A]],
    ['another store, never looked for in a bottle', [GOG], null, []],
    [
      'a Steam entry with neither folder nor app id',
      [{ type: 'steam', path: '' }],
      null,
      [],
    ],
  ])('finds %s', (_case, installPaths, appId, paths) => {
    expect(bottleGameCopies(installPaths, appId).map((copy) => copy.path)).toEqual(paths);
  });

  it('marks a copy with its bottle', () => {
    expect(bottleGameCopies([STEAM])).toEqual([
      { platform: 'steam', path: GAME_IN_A, exists: true, wine: BOTTLE },
    ]);
  });
});

describe('findBottleGameCopy', () => {
  it.each([
    ['the bottle that has it', BOTTLE.prefix, GAME_IN_A],
    ['a bottle without it', OTHER.prefix, null],
    ['a bottle LBK does not list', '/Bottles/gone', null],
  ])('looks in %s', (_case, prefix, found) => {
    expect(findBottleGameCopy(STEAM, null, prefix)?.path ?? null).toBe(found);
  });
});
