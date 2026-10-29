import type { ValueAnimationTransition } from 'framer-motion';

// How far the knob runs down its track, from rest to the bottom stop
export const LEVER_TRAVEL_PX = 144;

// Released past this share of the travel, the dragged knob finishes the pull; short of it, it springs back
const LEVER_PULL_SHARE = 0.6;
// Pointer travel before a press on the lever counts as a drag
export const LEVER_DRAG_SLOP_PX = 4;
// Chromium sends one pointermove a frame, so the teeth passed since the last one sound within the next
export const LEVER_DRAG_STEP_S = 1 / 60;

const RATCHET_TEETH = 6;
const PULL_S = 0.32;

export const leverReleasePulls = (travel: number): boolean => travel >= LEVER_PULL_SHARE;

// The knob follows the pointer down and never passes either end of its track
export const leverTravelForDrag = (dragPx: number): number =>
  Math.min(1, Math.max(0, dragPx / LEVER_TRAVEL_PX));

// Speeds up all the way down, so the knob hits the bottom hard
export const LEVER_PULL: ValueAnimationTransition<number> = {
  duration: PULL_S,
  ease: [0.45, 0, 0.9, 0.6],
};

// A heavy knob let go from its stop: the pull's speed dies there, and it springs past rest by under 3% of its travel
export const LEVER_RETURN: ValueAnimationTransition<number> = {
  type: 'spring',
  stiffness: 200,
  damping: 26,
  mass: 1.3,
  velocity: 0,
};

// The knob rests on its stop for a moment before the spring takes it back up
export const LEVER_BOTTOM_DWELL_S = 0.09;

// What is left of a pull's time once a drag has brought the knob part of the way
export const leverFinishTransition = (
  travel: number
): ValueAnimationTransition<number> & { duration: number } => ({
  ...LEVER_PULL,
  duration: PULL_S * Math.max(0.2, 1 - travel),
});

// The ratchet tooth the knob is on, 0 above the first and 6 at the bottom stop; each new one clicks
export const ratchetTooth = (travel: number): number =>
  Math.min(RATCHET_TEETH, Math.floor(Math.max(0, travel) * RATCHET_TEETH));

// The teeth a knob passes going down from tooth `from` to tooth `to`, in order; none on the way back up
export const teethPassed = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from) }, (_, index) => from + 1 + index);

// The teeth a released knob still runs over on its way to the bottom stop
export const teethLeftBelow = (tooth: number): number[] =>
  teethPassed(tooth, RATCHET_TEETH);
