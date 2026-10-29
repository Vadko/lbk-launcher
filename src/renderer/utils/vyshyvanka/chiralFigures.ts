import { fail } from './fail';
import { region, THREADS, type Thread } from './grid';

type Mask = boolean[][];
type Cells = Array<[number, number]>;

const KING_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const ROOK_STEPS = KING_STEPS.slice(0, 4);

function components(mask: Mask, diagonal: boolean): Cells[] {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const seen = mask.map((row) => row.map(() => false));
  const steps = diagonal ? KING_STEPS : ROOK_STEPS;
  const out: Cells[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!mask[r][c] || seen[r][c]) {
        continue;
      }
      const comp: Cells = [];
      const stack: Cells = [[r, c]];
      seen[r][c] = true;
      while (stack.length > 0) {
        const [y, x] = stack.pop() ?? fail('empty');
        comp.push([y, x]);
        for (const [dy, dx] of steps) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && mask[ny][nx] && !seen[ny][nx]) {
            seen[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
      out.push(comp);
    }
  }
  return out;
}

// The eight symmetries of a square, as maps on coordinates centred at 0 (doubled so half-cells stay integral)
const D4_MAPS: ReadonlyArray<(x: number, y: number) => [number, number]> = [
  (x, y) => [x, y],
  (x, y) => [-y, x],
  (x, y) => [-x, -y],
  (x, y) => [y, -x],
  (x, y) => [-x, y],
  (x, y) => [x, -y],
  (x, y) => [y, x],
  (x, y) => [-y, -x],
];

// Which of the eight maps keep a cell set (about its own bounding-box centre) unchanged
function symmetries(cells: Cells): boolean[] {
  const ys = cells.map(([y]) => y);
  const xs = cells.map(([, x]) => x);
  const cy = Math.min(...ys) + Math.max(...ys);
  const cx = Math.min(...xs) + Math.max(...xs);
  const key = new Set(cells.map(([y, x]) => `${2 * x - cx},${2 * y - cy}`));
  return D4_MAPS.map((m) =>
    cells.every(([y, x]) => key.has(m(2 * x - cx, 2 * y - cy).join(',')))
  );
}

// A shape that turns into itself but has no mirror axis is chiral: a pinwheel, a hooked cross or a lone S
function chiralRotation(cells: Cells, halfTurn: boolean): boolean {
  if (cells.length < 3) {
    return false;
  }
  const s = symmetries(cells);
  const rotates = s[1] || (halfTurn && s[2]);
  const mirrors = s[4] || s[5] || s[6] || s[7];
  return rotates && !mirrors;
}

// True when every set cell of the window maps to a set cell under the given map of window coordinates
function windowHolds(
  mask: Mask,
  r: number,
  c: number,
  size: number,
  map: (y: number, x: number, m: number) => readonly [number, number]
): boolean {
  const m = size - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[r + y][c + x]) {
        const [ty, tx] = map(y, x, m);
        if (!mask[r + ty][c + tx]) {
          return false;
        }
      }
    }
  }
  return true;
}

function windowCount(mask: Mask, r: number, c: number, size: number): number {
  let count = 0;
  for (let y = r; y < r + size; y++) {
    for (let x = c; x < c + size; x++) {
      count += mask[y][x] ? 1 : 0;
    }
  }
  return count;
}

const QUARTER_TURN = (y: number, x: number, m: number) => [x, m - y] as const;
const VERTICAL_AXIS = (y: number, x: number, m: number) => [y, m - x] as const;
const DIAGONAL_AXIS = (y: number, x: number) => [x, y] as const;

// Window scan, every size from 4 to the full grid, for a quarter-turn-invariant chiral figure embedded in a larger mass
function chiralWindow(mask: Mask): string | undefined {
  const n = mask.length;
  for (let size = 4; size <= n; size++) {
    for (let r = 0; r + size <= n; r++) {
      for (let c = 0; c + size <= n; c++) {
        if (
          windowHolds(mask, r, c, size, QUARTER_TURN) &&
          windowCount(mask, r, c, size) >= 5 &&
          !windowHolds(mask, r, c, size, VERTICAL_AXIS) &&
          !windowHolds(mask, r, c, size, DIAGONAL_AXIS)
        ) {
          return `${size}x${size} at ${c},${r}`;
        }
      }
    }
  }
  return undefined;
}

// Every non-empty set of threads: a figure split between threads still reads as one, and some palettes paint two threads alike
const THREAD_SETS: ReadonlyArray<readonly Thread[]> = Array.from(
  { length: 2 ** THREADS.length - 1 },
  (_, i) => THREADS.filter((_, bit) => ((i + 1) >> bit) & 1)
).sort((a, b) => a.length - b.length);

// Lists every rotation-only figure in any set of threads or in the linen gaps, tagged with the mask that shows it
export function chiralFigures(grid: string[][]): string[] {
  const inner = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < grid.length && c < grid.length && region(c, r) !== 'o';
  const stitched = (set: readonly Thread[]): Mask =>
    grid.map((row) => row.map((ch) => set.some((t) => t === ch)));
  const masks: ReadonlyArray<readonly [string, Mask]> = [
    ...THREAD_SETS.map((set) => [set.join(''), stitched(set)] as const),
    ['linen', grid.map((row, r) => row.map((ch, c) => ch === '.' && inner(r, c)))],
  ];
  const scanned = new Set<string>();
  const found: string[] = [];
  for (const [name, mask] of masks) {
    // A set whose other threads are absent repeats a smaller set's mask
    const key = `${name === 'linen'}:${mask.map((row) => row.map(Number).join('')).join('|')}`;
    if (scanned.has(key)) {
      continue;
    }
    scanned.add(key);
    for (const comp of components(mask, name !== 'linen')) {
      // Linen gaps only count as pinwheels; a lone S (half-turn only) counts in the threads
      if (chiralRotation(comp, name !== 'linen')) {
        found.push(`${name} figure ${JSON.stringify(comp)}`);
      }
    }
    const win = chiralWindow(mask);
    if (win) {
      found.push(`${name} window ${win}`);
    }
  }
  return found;
}
