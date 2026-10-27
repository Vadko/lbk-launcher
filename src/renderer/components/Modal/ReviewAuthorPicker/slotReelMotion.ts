import type { ValueAnimationTransition } from 'framer-motion';
import { type ReelFlags, SLOT_REELS, type SlotReelId } from './slotReels';

// What one cell of a strip shows; null is a blank cell before the first answer brings decoys
export type ReelCell = string | null;

export const REEL_CELL_PX = 52;
// The result in full and half of each neighbour, as through the window of a real machine
export const REEL_WINDOW_PX = 102;
// The drum the strip is wrapped round
const REEL_RADIUS_PX = 64;

// When each reel comes to rest, counted from the pull
const REST_AT_MS: Record<SlotReelId, number> = {
  avatar: 1250,
  adjective: 1650,
  noun: 2050,
};

const BRAKE_MS = 200;
// How long the recoil spring takes to come to rest from the overshoot
export const RECOIL_MS = 260;
const SETTLE_MS = BRAKE_MS + RECOIL_MS;
// Cells the brake runs through before the result
const BRAKE_CELLS = 2;
const OVERSHOOT_PX = 12;
const KICK_PX = 16;
const KICK_MS = 140;
const SPIN_UP_MS = 420;
const CELL_MS = 42;
const MIN_LOOP = 6;
const MAX_BLUR_PX = 12;
// At full speed the smear runs a word into the next, a grey band on the paper
const BLUR_PER_SPEED = 0.009;
// The speed reading lags a frame, and sharp decoys at the start of a spin read as a result
const MIN_SPIN_BLUR_PX = 2;

export interface ReelSchedule {
  // When each reel starts to settle, counted from the answer
  settle: Record<SlotReelId, number>;
  // When the last moving reel is at rest
  landed: number;
}

// A reel needs the answer's decoys to settle on, so a slow answer moves every stop by the same amount
export function reelSchedule(answeredAfterMs: number, moving: ReelFlags): ReelSchedule {
  const firstSettle = REST_AT_MS.avatar - SETTLE_MS;
  const shift = Math.max(0, answeredAfterMs - firstSettle);
  const fromAnswer = (reel: SlotReelId) =>
    REST_AT_MS[reel] - SETTLE_MS + shift - answeredAfterMs;
  const settle = {
    avatar: fromAnswer('avatar'),
    adjective: fromAnswer('adjective'),
    noun: fromAnswer('noun'),
  };
  const landed = Math.max(
    0,
    ...SLOT_REELS.filter((reel) => moving[reel]).map((reel) => settle[reel] + SETTLE_MS)
  );
  return { settle, landed };
}

// The strip's y that puts cell `index` in the middle of the window
export const reelOffset = (index: number): number =>
  (REEL_WINDOW_PX - REEL_CELL_PX) / 2 - index * REEL_CELL_PX;

export interface ReelCellProjection {
  // How far the drum moves the cell from its place on a flat strip
  shift: number;
  scale: number;
  // On the half of the drum that faces the window
  visible: boolean;
}

// A cell d px from the window's middle shows at r·sin(d/r), squashed by cos(d/r)
export function reelCellProjection(stripY: number, index: number): ReelCellProjection {
  const fromMiddle = stripY + (index + 0.5) * REEL_CELL_PX - REEL_WINDOW_PX / 2;
  const angle = fromMiddle / REEL_RADIUS_PX;
  if (Math.abs(angle) >= Math.PI / 2) {
    return { shift: 0, scale: 0, visible: false };
  }
  return {
    shift: REEL_RADIUS_PX * Math.sin(angle) - fromMiddle,
    scale: Math.cos(angle),
    visible: true,
  };
}

const cellAt = (decoys: readonly string[], index: number): ReelCell =>
  decoys.length > 0 ? decoys[index % decoys.length] : null;

// The result between two of the decoys it landed with, the same two the brake ends on
export function restCells(value: ReelCell, decoys: readonly string[]): ReelCell[] {
  return [cellAt(decoys, BRAKE_CELLS + 1), value, cellAt(decoys, 0)];
}

export interface ReelRest {
  value: ReelCell;
  // The decoys dealt with the value, which its neighbours come from
  decoys: readonly string[];
}

// A held reel keeps its neighbours while its word stays; one re-inflected for a noun of the other gender takes decoys dealt in that gender
export const heldReelRest = (
  rest: ReelRest,
  value: ReelCell,
  decoys: readonly string[]
): ReelRest => (value === rest.value ? rest : { value, decoys });

export interface SpinStrip {
  cells: ReelCell[];
  loop: number;
}

// Two copies of the decoys above the resting cells: the strip runs down into them and loops without a seam
export function spinStrip(value: ReelCell, decoys: readonly string[]): SpinStrip {
  const loop = Array.from({ length: Math.max(MIN_LOOP, decoys.length) }, (_, index) =>
    cellAt(decoys, index)
  );
  return { cells: [...loop, ...loop, ...restCells(value, decoys)], loop: loop.length };
}

// The decoys the brake runs through, below the cells the reel comes to rest on
export function settleStrip(value: ReelCell, decoys: readonly string[]): ReelCell[] {
  const run = Array.from({ length: BRAKE_CELLS }, (_, index) =>
    cellAt(decoys, index + 1)
  );
  return [...restCells(value, decoys), ...run];
}

export interface ReelMotionStep {
  keyframes: number[];
  transition: ValueAnimationTransition<number>;
}

// A jolt against the spin, then the reel speeds up and meets the loop at its pace
export function spinUpMotion(loop: number): ReelMotionStep {
  const rest = reelOffset(2 * loop + 1);
  return {
    keyframes: [rest, rest - KICK_PX, reelOffset(2 * loop - 2)],
    transition: {
      duration: SPIN_UP_MS / 1000,
      times: [0, KICK_MS / SPIN_UP_MS, 1],
      ease: ['easeOut', [0.5, 0, 0.75, 0.5]],
    },
  };
}

// Symbols travel down: the strip moves one copy of the loop and starts over
export function spinLoopMotion(loop: number): ReelMotionStep {
  return {
    keyframes: [reelOffset(2 * loop - 2), reelOffset(loop - 2)],
    transition: { duration: (loop * CELL_MS) / 1000, ease: 'linear', repeat: Infinity },
  };
}

// Leaves at the loop's pace and is still moving when it hits the stop a little past the result
export function brakeMotion(): ReelMotionStep {
  return {
    keyframes: [reelOffset(BRAKE_CELLS + 1), reelOffset(1) + OVERSHOOT_PX],
    transition: { duration: BRAKE_MS / 1000, ease: [0.3, 0.64, 0.65, 0.95] },
  };
}

// Knocks back from the stop onto the result, bouncing once
export function recoilMotion(): ReelMotionStep {
  return {
    keyframes: [reelOffset(1) + OVERSHOOT_PX, reelOffset(1)],
    transition: { type: 'spring', stiffness: 1600, damping: 32 },
  };
}

// The vertical smear, in px, for a reel speed in px/s either way
export const reelBlur = (speed: number, isSpinning: boolean): number =>
  Math.max(
    isSpinning ? MIN_SPIN_BLUR_PX : 0,
    Math.min(MAX_BLUR_PX, Math.round(Math.abs(speed) * BLUR_PER_SPEED * 10) / 10)
  );
