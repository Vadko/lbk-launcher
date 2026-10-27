import type { ValueAnimationTransition } from 'framer-motion';

export const LEVER_ROD_PX = 100;
// Released past this, the dragged lever finishes the pull; short of it, it springs back
export const LEVER_PULL_DEG = 100;
export const LEVER_DOWN_DEG = 180;
// Pointer travel before a press on the lever counts as a drag
export const LEVER_DRAG_SLOP_PX = 4;

const RATCHET_TEETH = 6;
const BALL_GROWTH = 0.22;
const PULL_S = 0.32;

// Speeds up all the way down, so the arm hits the bottom hard
export const LEVER_PULL: ValueAnimationTransition<number> = {
  duration: PULL_S,
  ease: [0.45, 0, 0.9, 0.6],
};

// A heavy arm let go from its stop: the pull's speed dies there, and it swings past upright by under 3°
export const LEVER_RETURN: ValueAnimationTransition<number> = {
  type: 'spring',
  stiffness: 200,
  damping: 26,
  mass: 1.3,
  velocity: 0,
};

// The arm rests on its stop for a moment before the spring takes it back up
export const LEVER_BOTTOM_DWELL_S = 0.09;

// The ball follows the pointer down: it drops by the rod's length times 1 - cos θ
export function leverAngleForDrag(dragPx: number): number {
  const drop = Math.min(Math.max(dragPx, 0), 2 * LEVER_ROD_PX);
  return (Math.acos(1 - drop / LEVER_ROD_PX) * 180) / Math.PI;
}

// What is left of a pull's time once a drag has brought the lever part of the way
export const leverFinishTransition = (
  angleDeg: number
): ValueAnimationTransition<number> => ({
  ...LEVER_PULL,
  duration: PULL_S * Math.max(0.2, 1 - angleDeg / LEVER_DOWN_DEG),
});

export interface LeverPose {
  // The rod's length on screen as a share of its real one, negative once it points down
  reach: number;
  ballScale: number;
}

// The arm swings toward the viewer, so the rod shortens and the ball grows as it passes the pivot; it never passes its bottom stop
export function leverPose(angleDeg: number): LeverPose {
  const angle = (Math.min(angleDeg, LEVER_DOWN_DEG) * Math.PI) / 180;
  return { reach: Math.cos(angle), ballScale: 1 + BALL_GROWTH * Math.sin(angle) };
}

// The ratchet tooth the arm is on; each new one clicks
export const ratchetTooth = (angleDeg: number): number =>
  Math.floor(Math.max(0, angleDeg) / (LEVER_DOWN_DEG / RATCHET_TEETH));
