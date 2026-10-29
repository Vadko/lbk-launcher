import { fail } from './fail';
import {
  type Grid,
  isThread,
  MID,
  mirrorH,
  mirrorV,
  type Placed,
  type Region,
  region,
  sameGrid,
  THREADS,
  transpose,
} from './grid';
import { ARMS, CORES, CORNERS, type Part } from './motifs';

export type PartKind = 'core' | 'arm' | 'corner';

export interface Library {
  readonly core: Record<string, Placed[]>;
  readonly arm: Record<string, Placed[]>;
  readonly corner: Record<string, Placed[]>;
  readonly symmetry: Record<string, string>;
}

// Where each kind's drawing sits on the 13x13 grid (column, row), and the region its stitches must stay in
export const ORIGIN: Record<PartKind, readonly [number, number]> = {
  core: [3, 3],
  arm: [3, 1],
  corner: [2, 2],
};
export const EXPECTED: Record<PartKind, Region> = { core: 'k', arm: 'v', corner: 'x' };

function cellAt(grid: Grid, r: number, c: number): string {
  return grid[r]?.[c] ?? fail(`out of range ${r},${c}`);
}

function checkShape(
  kind: PartKind,
  name: string,
  grid: Grid,
  rows: number,
  cols: number
): void {
  if (grid.length !== rows || grid.some((line) => line.length !== cols)) {
    fail(`${kind} ${name}: expected ${rows}x${cols}`);
  }
  if (grid.some((line) => [...line].some((ch) => ch !== '.' && !isThread(ch)))) {
    fail(`${kind} ${name}: only . and ${THREADS.join(' ')} allowed`);
  }
}

// Every drawn grid needs a mirror axis; the composition relies on exactly these axes
const SYMMETRY: Record<PartKind, (name: string, grid: Grid) => string> = {
  core: (name, grid) => {
    if (!sameGrid(grid, mirrorH(grid)) || !sameGrid(grid, mirrorV(grid))) {
      fail(`core ${name}: needs vertical and horizontal mirror axes`);
    }
    return sameGrid(grid, transpose(grid)) ? 'D4' : 'D2';
  },
  arm: (name, grid) => {
    if (!sameGrid(grid, mirrorH(grid))) {
      fail(`arm ${name}: needs a vertical mirror axis`);
    }
    return 'D1';
  },
  corner: (name, grid) => {
    if (!sameGrid(grid, transpose(grid))) {
      fail(`corner ${name}: needs the diagonal mirror axis`);
    }
    return 'D1 diagonal';
  },
};

const ANCHORS: Record<PartKind, (name: string, grid: Grid) => void> = {
  core: (name, grid) => {
    if (cellAt(grid, 0, 3) === '.' || cellAt(grid, 3, 0) === '.') {
      fail(`core ${name}: axis tips must be stitched`);
    }
  },
  arm: (name, grid) => {
    if (
      [cellAt(grid, 1, 3), cellAt(grid, 1, 2), cellAt(grid, 2, 2)].every(
        (ch) => ch === '.'
      )
    ) {
      fail(`arm ${name}: must touch the core tip`);
    }
  },
  corner: () => undefined,
};

// Places a part's full drawing on the 13x13 grid and checks every stitch stays inside its own region
function place(kind: PartKind, name: string, grid: Grid): Placed[] {
  const [c0, r0] = ORIGIN[kind];
  const out: Placed[] = [];
  grid.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (!isThread(ch)) {
        return;
      }
      const col = c0 + c;
      const row = r0 + r;
      if (region(col, row) !== EXPECTED[kind]) {
        fail(
          `${kind} ${name}: stitch at ${col},${row} lies in region ${region(col, row)}`
        );
      }
      out.push({ col, row, t: ch });
    });
  });
  return out;
}

const quadrant = (cells: Placed[]): Placed[] =>
  cells.filter((p) => p.col <= MID && p.row <= MID);

const SETS: ReadonlyArray<readonly [PartKind, Record<string, Part>, number, number]> = [
  ['core', CORES, 7, 7],
  ['arm', ARMS, 3, 7],
  ['corner', CORNERS, 3, 3],
];

// Checks every drawn part and keeps the top-left quarter of it, the slice the SVG draws
export function library(): Library {
  const lib: Library = { core: {}, arm: {}, corner: {}, symmetry: {} };
  for (const [kind, parts, rows, cols] of SETS) {
    for (const [name, part] of Object.entries(parts)) {
      checkShape(kind, name, part.grid, rows, cols);
      lib.symmetry[`${kind}.${name}`] = SYMMETRY[kind](name, part.grid);
      ANCHORS[kind](name, part.grid);
      lib[kind][name] = quadrant(place(kind, name, part.grid));
    }
  }
  return lib;
}
