import { describe, expect, it, vi } from 'vitest';
import type { InstallPath } from '../../shared/types';
import { bottleGameCopies, findBottleGameCopy } from './bottle-game-copies';

const BOTTLE = { prefix: '/Bottles/a', launcher: 'crossover' as const, label: 'a' };
const OTHER = { prefix: '/Bottles/b', launcher: 'crossover' as const, label: 'b' };
const STEAM_IN_A = '/Bottles/a/drive_c/Steam/steamapps/common/Game';
const GOG_IN_B = '/Bottles/b/drive_c/GOG Games/Game';
const EPIC_IN_A = '/Bottles/a/drive_c/Program Files/Epic Games/Game';

vi.mock('./prefixes', () => ({ listWinePrefixes: () => [BOTTLE, OTHER] }));
// Only bottle a has Steam
vi.mock('./bottle-steam-roots', () => ({
  bottleSteams: () => [{ prefix: BOTTLE, steamPath: '/Bottles/a/drive_c/Steam' }],
  findBottleSteamGame: () => STEAM_IN_A,
}));
vi.mock('./bottle-gog', () => ({
  findBottleGogGame: (prefix: string) => (prefix === OTHER.prefix ? GOG_IN_B : null),
}));
vi.mock('./bottle-epic', () => ({
  findBottleEpicGame: (prefix: string) => (prefix === BOTTLE.prefix ? EPIC_IN_A : null),
}));

const STEAM: InstallPath = { type: 'steam', path: 'Game' };
const GOG: InstallPath = { type: 'gog', path: 'Game' };
const EPIC: InstallPath = { type: 'epic', path: 'Game' };

describe('bottleGameCopies', () => {
  it.each<[string, InstallPath[], number | null, string[]]>([
    ['a Steam entry, in the bottle with Steam', [STEAM], null, [STEAM_IN_A]],
    ['a GOG entry, in the bottle that has it', [GOG], null, [GOG_IN_B]],
    ['an Epic entry, in the bottle that has it', [EPIC], null, [EPIC_IN_A]],
    [
      'every store of a game, bottle by bottle',
      [STEAM, GOG, EPIC],
      null,
      [STEAM_IN_A, EPIC_IN_A, GOG_IN_B],
    ],
    ['a store no bottle client is read for', [{ type: 'xbox', path: 'Game' }], null, []],
    [
      'a Steam entry with neither folder nor app id',
      [{ type: 'steam', path: '' }],
      null,
      [],
    ],
    ['a GOG entry without a folder', [{ type: 'gog', path: '' }], null, []],
  ])('finds %s', (_case, installPaths, appId, paths) => {
    expect(bottleGameCopies(installPaths, appId).map((copy) => copy.path)).toEqual(paths);
  });

  it('marks a copy with its store and bottle', () => {
    expect(bottleGameCopies([GOG])).toEqual([
      { platform: 'gog', path: GOG_IN_B, exists: true, wine: OTHER },
    ]);
  });
});

describe('findBottleGameCopy', () => {
  it.each<[string, InstallPath, string, string | null]>([
    ['the bottle that has it', GOG, OTHER.prefix, GOG_IN_B],
    ['a bottle without it', GOG, BOTTLE.prefix, null],
    ['a bottle without Steam', STEAM, OTHER.prefix, null],
    ['a bottle LBK does not list', EPIC, '/Bottles/gone', null],
  ])('looks in %s', (_case, installPath, prefix, found) => {
    expect(findBottleGameCopy(installPath, null, prefix)?.path ?? null).toBe(found);
  });
});
