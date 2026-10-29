import { checkCombo } from './checkCombo';
import { chiralFigures } from './chiralFigures';
import { compose } from './compose';
import { fail } from './fail';
import { type Grid, MID, mirrorH, N } from './grid';
import type { Library } from './library';
import { CORES } from './motifs';
import { rejectsWith } from './rejectsWith';

const HOOKED = ['A.AAA', 'A.A..', 'AAAAA', '..A.A', 'AAA.A'];
const BLADES = ['.AA...', '.....A', '.....A', 'A.....', 'A.....', '...AA.'];
const FRAMED = [
  'BBBBBBB',
  'BA.AAAB',
  'BA.A..B',
  'BAAAAAB',
  'B..A.AB',
  'BAAA.AB',
  'BBBBBBB',
];
const JOINED = [
  'AAAAAAA',
  'AA.AAAA',
  'AA.A..A',
  'AAAAAAA',
  'A..A.AA',
  'AAAA.AA',
  'AAAAAAA',
];
const HOLES = [
  'ABABABA',
  'B.A...B',
  'A.A.AAA',
  'B.....B',
  'AAA.A.A',
  'B...A.B',
  'ABABABA',
];
// The hooked cross with its arms in two threads, around stitches of the third
const SPLIT = ['C.BBB', 'C.BAA', 'CCACC', '..B.C', 'BBB.C'];
// The hooked cross in two threads exactly, with a third-thread stitch in one gap
const SPLIT_EXACT = ['B.CCC', 'B.B.A', 'BBBBB', '..B.C', 'CCB.C'];

const swap = (lines: Grid, from: string, to: string): Grid =>
  lines.map((l) =>
    [...l].map((ch) => (ch === from ? to : ch === to ? from : ch)).join('')
  );

// Rotation-only figures the detector must catch: drawing, top-left cell, the mask and finder that must name it
const CHIRAL: ReadonlyArray<readonly [string, Grid, readonly [number, number], RegExp]> =
  [
    ['hooked cross', HOOKED, [4, 4], /^A figure/],
    ['hooked cross, mirrored', mirrorH(HOOKED), [4, 4], /^A figure/],
    ['hooked cross off-centre', HOOKED, [1, 2], /^A figure/],
    [
      'hooked cross in the fill thread',
      HOOKED.map((l) => l.replaceAll('A', 'B')),
      [4, 4],
      /^B figure/,
    ],
    ['four separate blades', BLADES, [3, 3], /^A window 6x6/],
    ['hooked cross framed in another thread', FRAMED, [3, 3], /^A figure/],
    ['hooked cross joined to its frame', JOINED, [3, 3], /^A figure/],
    ['hooked cross cut into linen', HOLES, [3, 3], /^linen figure/],
    ['lone S', ['.AA', 'AA.'], [5, 5], /^A figure/],
    ['hooked cross split across fill and accent', SPLIT, [4, 4], /^BC (figure|window)/],
    [
      'hooked cross split across fill and accent exactly',
      SPLIT_EXACT,
      [4, 4],
      /^BC (figure|window)/,
    ],
    [
      'hooked cross split across main and fill',
      swap(SPLIT, 'A', 'C'),
      [4, 4],
      /^AB (figure|window)/,
    ],
    [
      'hooked cross split across main and accent',
      swap(SPLIT_EXACT, 'A', 'B'),
      [4, 4],
      /^AC (figure|window)/,
    ],
  ];

const CONTROLS: ReadonlyArray<readonly [string, Grid]> = [
  ['plus', ['..A..', '..A..', 'AAAAA', '..A..', '..A..']],
  ['rhomb', ['..A..', '.A.A.', 'A...A', '.A.A.', '..A..']],
  ['rhomb with hooks', ['AA.AA', 'A.A.A', '.AAA.', 'A.A.A', 'AA.AA']],
  ['plus split across fill and accent', ['..B..', '..B..', 'CCACC', '..B..', '..B..']],
];

function planted(lines: Grid, [col, row]: readonly [number, number]): string[][] {
  const grid = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch !== '.') {
        grid[row + r][col + c] = ch;
      }
    });
  });
  return grid;
}

// The off-axis top-left quarter of a composition, turned four times about the centre instead of mirrored
function turnedQuarter(grid: string[][]): string[][] {
  const out = grid.map((row) => row.map(() => '.'));
  const last = N - 1;
  for (let r = 0; r < MID; r++) {
    for (let c = 0; c < MID; c++) {
      out[r][c] = grid[r][c];
      out[c][last - r] = grid[r][c];
      out[last - r][last - c] = grid[r][c];
      out[last - c][r] = grid[r][c];
    }
  }
  return out;
}

// The chirality scan must name every rotation-only figure and still accept mirror-symmetric controls
export function chiralitySelfTest(lib: Library): void {
  for (const [label, lines, at, finder] of CHIRAL) {
    const found = chiralFigures(planted(lines, at));
    if (!found.some((f) => finder.test(f))) {
      fail(
        `self-test: ${label} was not rejected by ${finder} (found: ${found.join('; ') || 'nothing'})`
      );
    }
  }
  for (const [label, lines] of CONTROLS) {
    const found = chiralFigures(planted(lines, [4, 4]));
    if (found.length > 0) {
      fail(`self-test: mirror-symmetric ${label} was rejected (${found[0]})`);
    }
  }
  // A D2 core keeps the quarter off its diagonal, where a quarter-turn and a mirror would draw the same picture
  const d2 =
    Object.keys(CORES).find((name) => lib.symmetry[`core.${name}`] === 'D2') ??
    fail('self-test needs a D2 core');
  const pinwheel = turnedQuarter(compose(lib, d2, 'tbar', 'cap'));
  rejectsWith(
    'an off-axis quarter placed by rotations',
    () => checkCombo(pinwheel, 'self-test'),
    /lost its mirror axes/
  );
  if (chiralFigures(pinwheel).length === 0) {
    fail('self-test: the chirality scan missed an off-axis quarter placed by rotations');
  }
}
