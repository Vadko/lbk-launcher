// Main (form), fill and accent threads
export const THREADS = ['A', 'B', 'C'] as const;
export type Thread = (typeof THREADS)[number];
export type Grid = readonly string[];
export type Region = 'k' | 'v' | 'h' | 'x' | 'o';

export interface Placed {
  readonly col: number;
  readonly row: number;
  readonly t: Thread;
}

export const N = 13;
export const MID = 6;
export const UNIT = 2;
export const SIZE = N * UNIT;

// Cell (dx, dy) from the centre: core diamond, vertical/horizontal arm wedges, diagonal corner wedges, outer ring
export function region(col: number, row: number): Region {
  const dx = Math.abs(col - MID);
  const dy = Math.abs(row - MID);
  if (dx + dy <= 3) {
    return 'k';
  }
  if (Math.hypot(dx, dy) > 5.6) {
    return 'o';
  }
  if (dy >= dx + 2) {
    return 'v';
  }
  if (dx >= dy + 2) {
    return 'h';
  }
  return 'x';
}

export const INNER: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: N * N },
  (_, i): [number, number] => [Math.floor(i / N), i % N]
).filter(([r, c]) => region(c, r) !== 'o');

export const isThread = (ch: string): ch is Thread => THREADS.some((t) => t === ch);
export const mirrorH = (g: Grid): Grid => g.map((line) => [...line].reverse().join(''));
export const mirrorV = (g: Grid): Grid => [...g].reverse();
export const transpose = (g: Grid): Grid =>
  g.map((_, r) => g.map((line) => line[r]).join(''));
export const sameGrid = (a: Grid, b: Grid): boolean => a.join('\n') === b.join('\n');
