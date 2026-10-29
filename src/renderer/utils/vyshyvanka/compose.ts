import { fail } from './fail';
import { N, type Placed, UNIT } from './grid';
import type { Library } from './library';

// The quarter is drawn once and placed by these four transforms only: identity and the three mirrors, never a rotation
export const MIRRORS: readonly string[] = [
  '',
  'matrix(-1 0 0 1 26 0)',
  'matrix(1 0 0 -1 0 26)',
  'matrix(-1 0 0 -1 26 26)',
];
// Inside the quarter the horizontal arm is the vertical one reflected across the diagonal, so it stays a mirror image too
export const TRANSPOSE = 'matrix(0 1 1 0 0 0)';
export const QUARTER: ReadonlyArray<readonly ['k' | 'a' | 'x', string]> = [
  ['k', ''],
  ['a', ''],
  ['a', TRANSPOSE],
  ['x', ''],
];

// Maps a cell through an SVG matrix() the way the renderer does, via the cell's centre in user units
function applyMatrix(transform: string, p: Placed): Placed {
  if (transform === '') {
    return p;
  }
  const m =
    /^matrix\(([-\d. ]+)\)$/.exec(transform)?.[1].split(' ').map(Number) ??
    fail(`unreadable transform ${transform}`);
  const [a, b, c, d, e, f] = m;
  const x = p.col * UNIT + UNIT / 2;
  const y = p.row * UNIT + UNIT / 2;
  return {
    col: (a * x + c * y + e - UNIT / 2) / UNIT,
    row: (b * x + d * y + f - UNIT / 2) / UNIT,
    t: p.t,
  };
}

// Rebuilds the 13x13 grid from the same transform tables the SVG uses: the quarter's parts, then the quarter four times
export function compose(
  lib: Library,
  core: string,
  arm: string,
  corner: string,
  quarters: readonly string[] = MIRRORS
): string[][] {
  const parts = {
    k: lib.core[core] ?? fail(core),
    a: lib.arm[arm] ?? fail(arm),
    x: lib.corner[corner] ?? fail(corner),
  };
  const q = QUARTER.flatMap(([name, t]) => parts[name].map((p) => applyMatrix(t, p)));
  const grid = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  for (const transform of quarters) {
    for (const p of q.map((cell) => applyMatrix(transform, cell))) {
      const prev =
        grid[p.row]?.[p.col] ??
        fail(`cell ${p.col},${p.row} off the grid in ${core}/${arm}/${corner}`);
      if (prev !== '.' && prev !== p.t) {
        fail(`collision at ${p.col},${p.row} in ${core}/${arm}/${corner}`);
      }
      grid[p.row][p.col] = p.t;
    }
  }
  return grid;
}
