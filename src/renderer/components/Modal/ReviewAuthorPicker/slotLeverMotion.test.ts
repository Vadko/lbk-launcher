import { spring } from 'framer-motion';
import { describe, expect, it } from 'vitest';
import {
  LEVER_DOWN_DEG,
  LEVER_PULL,
  LEVER_RETURN,
  LEVER_ROD_PX,
  leverAngleForDrag,
  leverFinishTransition,
  leverPose,
  ratchetTooth,
} from './slotLeverMotion';

describe('leverAngleForDrag', () => {
  it.each([
    ['no drag', 0, 0],
    ['a drag up', -40, 0],
    ['the ball level with the pivot', LEVER_ROD_PX, 90],
    ['the full travel', 2 * LEVER_ROD_PX, 180],
    ['a drag past the bottom', 3 * LEVER_ROD_PX, 180],
  ])('turns %s into the arm angle', (_label, drag, angle) => {
    expect(leverAngleForDrag(drag)).toBeCloseTo(angle);
  });

  it('keeps the ball under the pointer', () => {
    const drag = 30;
    const { reach } = leverPose(leverAngleForDrag(drag));

    expect(LEVER_ROD_PX * (1 - reach)).toBeCloseTo(drag);
  });
});

describe('leverPose', () => {
  it.each([
    ['upright', 0, 1, 1],
    ['pointing at the viewer', 90, 0, 1.22],
    ['pulled down', 180, -1, 1],
  ])('shows the arm %s', (_label, angle, reach, ballScale) => {
    const pose = leverPose(angle);

    expect(pose.reach).toBeCloseTo(reach);
    expect(pose.ballScale).toBeCloseTo(ballScale);
  });

  it('shrinks the ball when the spring swings the arm back past upright', () => {
    expect(leverPose(-3).ballScale).toBeLessThan(1);
  });

  it('stops the arm dead at the bottom however far the angle runs on', () => {
    expect(leverPose(LEVER_DOWN_DEG + 28)).toEqual(leverPose(LEVER_DOWN_DEG));
  });
});

describe('lever return', () => {
  // framer-motion starts a spring at the value's own speed unless the transition names one
  const hitSpeed = 2150;
  const swing = spring({
    keyframes: [LEVER_DOWN_DEG, 0],
    velocity: hitSpeed,
    ...LEVER_RETURN,
  });
  const angles = Array.from({ length: 750 }, (_, step) => swing.next(step * 4).value);

  it('leaves the bottom stop at rest, whatever speed the pull hit it with', () => {
    expect(Math.max(...angles)).toBe(LEVER_DOWN_DEG);
  });

  it('swings at most 5° past upright and settles there', () => {
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(-5);
    expect(Math.min(...angles)).toBeLessThan(0);
    expect(swing.next(3000)).toEqual({ done: true, value: 0 });
  });
});

describe('lever travel', () => {
  it.each([
    ['at rest', 0, 0],
    ['just past the first tooth', 31, 1],
    ['at the bottom', LEVER_DOWN_DEG, 6],
  ])('counts ratchet teeth %s', (_label, angle, tooth) => {
    expect(ratchetTooth(angle)).toBe(tooth);
  });

  it('finishes a half-dragged pull in half the time', () => {
    expect(leverFinishTransition(90).duration).toBeCloseTo(
      (LEVER_PULL.duration ?? 0) / 2
    );
  });
});
