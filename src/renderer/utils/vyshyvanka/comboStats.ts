import { INNER, N, region } from './grid';

export interface ComboStats {
  readonly density: number;
  readonly edge: number;
  readonly lone: number;
}

const ORTHO = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

// Density (stitched share of the disc), colour changes between neighbours, and stitches with no same-thread neighbour
export function comboStats(grid: string[][]): ComboStats {
  const stitched = INNER.filter(([r, c]) => grid[r][c] !== '.');
  let pairs = 0;
  let changes = 0;
  for (const [r, c] of INNER) {
    for (const [dr, dc] of ORTHO.slice(0, 2)) {
      if (r + dr < N && c + dc < N && region(c + dc, r + dr) !== 'o') {
        pairs += 1;
        changes += grid[r][c] === grid[r + dr][c + dc] ? 0 : 1;
      }
    }
  }
  const lone = stitched.filter(
    ([r, c]) => !ORTHO.some(([dr, dc]) => grid[r + dr]?.[c + dc] === grid[r][c])
  ).length;
  return {
    density: stitched.length / INNER.length,
    edge: changes / pairs,
    lone: stitched.length === 0 ? 0 : lone / stitched.length,
  };
}
