import { spring } from 'framer-motion';
import { describe, expect, it } from 'vitest';
import {
  LEVER_PULL,
  LEVER_RETURN,
  LEVER_TRAVEL_PX,
  leverFinishTransition,
  leverReleasePulls,
  leverTravelForDrag,
  ratchetTooth,
  teethLeftBelow,
  teethPassed,
} from './slotLeverMotion';

describe('leverTravelForDrag', () => {
  it.each([
    ['no drag', 0, 0],
    ['a drag up', -40, 0],
    ['a drag down half the track', LEVER_TRAVEL_PX / 2, 0.5],
    ['the full track', LEVER_TRAVEL_PX, 1],
    ['a drag past the bottom', LEVER_TRAVEL_PX + 60, 1],
  ])('turns %s into the knob’s travel', (_label, drag, travel) => {
    expect(leverTravelForDrag(drag)).toBeCloseTo(travel);
  });
});

describe('leverReleasePulls', () => {
  it.each([
    ['springs back from', 0, false],
    ['springs back from', 0.55, false],
    ['spins the reels from', 0.6, true],
    ['spins the reels from', 1, true],
  ])('%s a knob let go at %s of its travel', (_label, travel, pulls) => {
    expect(leverReleasePulls(travel)).toBe(pulls);
  });
});

describe('lever return', () => {
  // framer-motion starts a spring at the value's own speed unless the transition names one
  const hitSpeed = 20;
  const swing = spring({ keyframes: [1, 0], velocity: hitSpeed, ...LEVER_RETURN });
  const travels = Array.from({ length: 750 }, (_, step) => swing.next(step * 4).value);

  it('leaves the bottom stop at rest, whatever speed the pull hit it with', () => {
    expect(Math.max(...travels)).toBe(1);
  });

  it('springs at most 3% past rest and settles there', () => {
    expect(Math.min(...travels)).toBeGreaterThanOrEqual(-0.03);
    expect(Math.min(...travels)).toBeLessThan(0);
    expect(swing.next(3000)).toEqual({ done: true, value: 0 });
  });
});

describe('lever ratchet', () => {
  it.each([
    ['at rest', 0, 0],
    ['above rest on the spring', -0.02, 0],
    ['just short of the first tooth', 0.16, 0],
    ['just past the first tooth', 0.17, 1],
    ['at the bottom', 1, 6],
    ['past the bottom', 1.2, 6],
  ])('counts ratchet teeth %s', (_label, travel, teeth) => {
    expect(ratchetTooth(travel)).toBe(teeth);
  });

  it.each([
    ['a step onto the next tooth', 2, 3, [3]],
    ['a fast step over three teeth', 1, 4, [2, 3, 4]],
    ['a whole drag from rest to the bottom', 0, 6, [1, 2, 3, 4, 5, 6]],
    ['staying on one tooth', 3, 3, []],
    ['going back up', 4, 2, []],
  ])('sounds every tooth of %s, in order', (_label, from, to, teeth) => {
    expect(teethPassed(from, to)).toEqual(teeth);
  });

  it('runs a whole drag down the track through each of the six teeth once', () => {
    const steps = Array.from({ length: 73 }, (_, step) =>
      ratchetTooth(leverTravelForDrag(step * 2))
    );

    const teeth = steps.flatMap((tooth, step) =>
      teethPassed(steps[step - 1] ?? 0, tooth)
    );

    expect(teeth).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('clicks a tooth again when the hand backs up and brings the knob past it once more', () => {
    const steps = [0.7, 0.4, 1].map((travel) => ratchetTooth(travel));

    const teeth = steps.flatMap((tooth, step) =>
      teethPassed(steps[step - 1] ?? 0, tooth)
    );

    expect(teeth).toEqual([1, 2, 3, 4, 3, 4, 5, 6]);
  });

  it.each([
    ['from rest', 0, [1, 2, 3, 4, 5, 6]],
    ['from the pull threshold', ratchetTooth(0.6), [4, 5, 6]],
    ['from the last tooth above the stop', 5, [6]],
    ['from the bottom stop', ratchetTooth(1), []],
  ])('runs a released knob over the teeth left below it %s', (_label, tooth, teeth) => {
    expect(teethLeftBelow(tooth)).toEqual(teeth);
  });

  it.each([
    ['finishes a half-dragged pull in half the time', 0.5, 0.5],
    ['gives a pull dragged almost to the stop a fifth of the time', 0.95, 0.2],
  ])('%s', (_label, travel, share) => {
    expect(leverFinishTransition(travel).duration).toBeCloseTo(
      (LEVER_PULL.duration ?? 0) * share
    );
  });
});
