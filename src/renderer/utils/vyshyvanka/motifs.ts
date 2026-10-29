import type { Grid } from './grid';

export interface Part {
  readonly grid: Grid;
  readonly weight?: number;
}

// Cores: 7x7, only |dx|+|dy| <= 3, mirror-symmetric on both axes, axis tips always stitched (the arms' anchor)
export const CORES: Record<string, Part> = {
  dot: {
    grid: ['...A...', '..A.A..', '.A...A.', 'A..C..A', '.A...A.', '..A.A..', '...A...'],
    weight: 2,
  },
  grain: {
    grid: ['...A...', '..A.A..', '.A.B.A.', 'A.BCB.A', '.A.B.A.', '..A.A..', '...A...'],
    weight: 1.8,
  },
  christ: {
    grid: ['...A...', '..ABA..', '.A.B.A.', 'ABBCBBA', '.A.B.A.', '..ABA..', '...A...'],
    weight: 1.5,
  },
  crossed: {
    grid: ['...A...', '..AAA..', '.A.A.A.', 'AAACAAA', '.A.A.A.', '..AAA..', '...A...'],
    weight: 2,
  },
  solid: {
    grid: ['...A...', '..AAA..', '.AABAA.', 'AABCBAA', '.AABAA.', '..AAA..', '...A...'],
    weight: 1.1,
  },
  rings: {
    grid: ['...A...', '..ABA..', '.ABABA.', 'ABACABA', '.ABABA.', '..ABA..', '...A...'],
    weight: 0.3,
  },
  plus: {
    grid: ['...A...', '...A...', '...A...', 'AAACAAA', '...A...', '...A...', '...A...'],
  },
  star: {
    grid: ['...A...', '...A...', '..BAB..', 'AAACAAA', '..BAB..', '...A...', '...A...'],
    weight: 3,
  },
  zhy: {
    grid: ['...A...', '..BAB..', '.BBABB.', 'AAACAAA', '.BBABB.', '..BAB..', '...A...'],
    weight: 1.1,
  },
  hollowB: {
    grid: ['...B...', '..B.B..', '.B.A.B.', 'B.ACA.B', '.B.A.B.', '..B.B..', '...B...'],
    weight: 0.5,
  },
  flower: {
    grid: ['...A...', '..BAB..', '.BB.BB.', 'AA.C.AA', '.BB.BB.', '..BAB..', '...A...'],
    weight: 3,
  },
  sun: {
    grid: ['...A...', '...A...', '..BBB..', 'AABCBAA', '..BBB..', '...A...', '...A...'],
    weight: 2,
  },
  square: {
    grid: ['...A...', '..A.A..', '.ABBBA.', 'A.BCB.A', '.ABBBA.', '..A.A..', '...A...'],
    weight: 1.9,
  },
  zerno: {
    grid: ['...A...', '..ABA..', '.ABBBA.', 'ABBCBBA', '.ABBBA.', '..ABA..', '...A...'],
    weight: 0.9,
  },
  frame: {
    grid: ['...A...', '..ABA..', '.AB.BA.', 'AB.C.BA', '.AB.BA.', '..ABA..', '...A...'],
    weight: 0.7,
  },
  corners: {
    grid: ['...A...', '..A.A..', '.AA.AA.', 'A..B..A', '.AA.AA.', '..A.A..', '...A...'],
  },
  beads: {
    grid: ['...A...', '...A...', '...B...', 'AABABAA', '...B...', '...A...', '...A...'],
  },
  diamondB: {
    grid: ['...A...', '..BBB..', '.BBBBB.', 'ABBCBBA', '.BBBBB.', '..BBB..', '...A...'],
    weight: 1.1,
  },
  doubleCross: {
    grid: ['...A...', '...A...', '..A.A..', 'AA.C.AA', '..A.A..', '...A...', '...A...'],
    weight: 2,
  },
  lens: {
    grid: ['...A...', '..AAA..', '...A...', 'B..C..B', '...A...', '..AAA..', '...A...'],
  },
  oval: {
    grid: ['...A...', '..ABA..', '..ABA..', 'A.ACA.A', '..ABA..', '..ABA..', '...A...'],
  },
  // From the rosette set: a sown field (rhomb quartered by a cross, a grain in each field) and a crosslet
  field: {
    grid: ['...A...', '..AAA..', '.ABABA.', 'AAACAAA', '.ABABA.', '..AAA..', '...A...'],
    weight: 0.8,
  },
  crosslet: {
    grid: ['...A...', '..ABA..', '.A.A.A.', 'ABACABA', '.A.A.A.', '..ABA..', '...A...'],
    weight: 0.5,
  },
};

// Arms: the top wedge (dy 5, 4, 3 from the centre), mirror-symmetric, always touching the core's axis tip
export const ARMS: Record<string, Part> = {
  stem: { grid: ['...A...', '...A...', '.......'] },
  stemC: { grid: ['...C...', '...A...', '.......'] },
  fork: { grid: ['..A.A..', '...A...', '.......'], weight: 2 },
  vee: { grid: ['.A...A.', '..A.A..', '.......'], weight: 0.2 },
  chevron: { grid: ['...A...', '..A.A..', '.......'], weight: 0.2 },
  rhomb: { grid: ['...A...', '..ABA..', '.......'], weight: 0.4 },
  rhombC: { grid: ['...A...', '..ACA..', '.......'], weight: 0.3 },
  cross: { grid: ['...A...', '..AAA..', '.......'], weight: 2 },
  anchor: { grid: ['.AAAAA.', '.A.A.A.', '.......'], weight: 0.9 },
  tbar: { grid: ['.AAAAA.', '...A...', '.......'] },
  horns: { grid: ['.AA.AA.', '.A.A.A.', '.......'], weight: 2 },
  pine: { grid: ['.A.A.A.', '..AAA..', '..A.A..'], weight: 0.8 },
  leaf: { grid: ['..AAA..', '..ABA..', '..A.A..'], weight: 0.9 },
  petal: { grid: ['...A...', '..AAA..', '..A.A..'], weight: 2 },
  blockB: { grid: ['..BBB..', '..BBB..', '.......'] },
  crown: { grid: ['.A.A.A.', '.AAAAA.', '..A.A..'], weight: 0.3 },
  stub: { grid: ['.......', '...A...', '.......'] },
  split: { grid: ['..A.A..', '..A.A..', '..A.A..'] },
  loop: { grid: ['..AAA..', '..A.A..', '..A.A..'], weight: 2 },
  grapes: { grid: ['.BBBBB.', '..BBB..', '.......'], weight: 0.8 },
  kalyna: { grid: ['.C.A.C.', '..AAA..', '.......'], weight: 1.7 },
  buds: { grid: ['..BAB..', '...A...', '.......'], weight: 2 },
  cup: { grid: ['.A...A.', '.AA.AA.', '.......'], weight: 2 },
  barB: { grid: ['.BBBBB.', '...A...', '.......'] },
  tree: { grid: ['..BAB..', '..BAB..', '..A.A..'], weight: 0.8 },
  arrow: { grid: ['...C...', '..AAA..', '.......'] },
  comb: { grid: ['.A.A.A.', '.AAAAA.', '.......'], weight: 0.7 },
  hooks: { grid: ['.AA.AA.', '..A.A..', '.......'], weight: 2 },
  flame: { grid: ['...A...', '..ABA..', '..A.A..'] },
  // From the rosette set: a lily (bud between two outward petals) and a full oak leaf with its vein
  lily: { grid: ['.A.B.A.', '..ABA..', '..A.A..'], weight: 0.4 },
  oak: { grid: ['..ABA..', '.AABAA.', '..A.A..'], weight: 0.2 },
  // Fill-thread twins of clean arms
  cupB: { grid: ['.B...B.', '.BB.BB.', '.......'] },
  hornsB: { grid: ['.BB.BB.', '.B.B.B.', '.......'], weight: 0.6 },
  crossB: { grid: ['...B...', '..BBB..', '.......'] },
};

// Corners: the diagonal wedge in top-left orientation (centre toward the bottom right), symmetric about the diagonal
export const CORNERS: Record<string, Part> = {
  none: { grid: ['...', '...', '...'], weight: 4 },
  diag: { grid: ['...', '.A.', '..A'], weight: 2 },
  diagB: { grid: ['...', '.B.', '..B'], weight: 2 },
  diagC: { grid: ['...', '.C.', '..A'] },
  plus: { grid: ['.A.', 'AAA', '.A.'], weight: 0.3 },
  plusC: { grid: ['.A.', 'ACA', '.A.'], weight: 0.3 },
  plusB: { grid: ['.B.', 'BBB', '.B.'], weight: 0.3 },
  cap: { grid: ['.A.', 'AA.', '...'], weight: 2 },
  blockIn: { grid: ['...', '.BB', '.BB'], weight: 1.3 },
  blockInC: { grid: ['...', '.AA', '.AC'], weight: 0.4 },
  fork: { grid: ['.A.', 'AA.', '..A'], weight: 1.5 },
  chevron: { grid: ['...', '..A', '.A.'] },
  leaf: { grid: ['.A.', 'AB.', '...'], weight: 1.8 },
  tri: { grid: ['...', '..A', '.AA'] },
  outer: { grid: ['.A.', 'A..', '...'] },
  vee: { grid: ['...', '.AA', '.A.'], weight: 0.9 },
  gem: { grid: ['.A.', 'ABA', '.AA'], weight: 0.2 },
  // Fill-thread twins of the light corners: one solid colour per figure keeps them clean at 24 px
  outerB: { grid: ['.B.', 'B..', '...'] },
  capB: { grid: ['.B.', 'BB.', '...'] },
  veeB: { grid: ['...', '.BB', '.B.'], weight: 0.8 },
  triB: { grid: ['...', '..B', '.BB'] },
};
