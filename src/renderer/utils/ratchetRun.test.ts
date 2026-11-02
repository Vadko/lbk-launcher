import { describe, expect, it } from 'vitest';
import {
  LEVER_DRAG_STEP_S,
  leverFinishTransition,
  ratchetTooth,
  teethLeftBelow,
  teethPassed,
} from '../components/Modal/ReviewAuthorPicker/slotLeverMotion';
import { ratchetRun } from './ratchetRun';

describe('ratchetRun', () => {
  it('spreads a run over the time it is given', () => {
    const run = ratchetRun(10, 0, 3, 0.06);

    expect(run.at).toEqual([10, expect.closeTo(10.02), expect.closeTo(10.04)]);
    expect(run.free).toBeCloseTo(10.06);
  });

  it('keeps a slow run at the pull’s fastest pace instead of stretching it', () => {
    const run = ratchetRun(10, 0, 2, 1);

    expect(run.at).toEqual([10, expect.closeTo(10.04)]);
  });

  it('starts behind the teeth still queued and still ends within its time', () => {
    const run = ratchetRun(10, 10.01, 2, 0.05);

    expect(run.at).toEqual([10.01, expect.closeTo(10.03)]);
    expect(run.free).toBeCloseTo(10.05);
  });

  it('never sounds two teeth as one, even with no time left', () => {
    const run = ratchetRun(10, 10.5, 2, 0.1);

    expect(run.at).toEqual([10.5, expect.closeTo(10.505)]);
  });

  it('queues nothing for no teeth', () => {
    expect(ratchetRun(10, 9, 0, LEVER_DRAG_STEP_S)).toEqual({ at: [], free: 10 });
  });
});

// The hook's own schedule: teeth passed by each pointermove within a frame, then the ones left at release before the thunk
function flickThenRelease(moves: { now: number; travel: number }[], releaseAt: number) {
  let free = 0;
  let tooth = 0;
  const at: number[] = [];
  const queue = (now: number, teeth: number[], withinS: number) => {
    const run = ratchetRun(now, free, teeth.length, withinS);
    free = run.free;
    at.push(...run.at);
  };
  for (const move of moves) {
    const next = ratchetTooth(move.travel);
    queue(move.now, teethPassed(tooth, next), LEVER_DRAG_STEP_S);
    tooth = next;
  }
  const finish = leverFinishTransition(moves.at(-1)?.travel ?? 0);
  queue(releaseAt, teethLeftBelow(tooth), finish.duration);
  return { at, thunkAt: releaseAt + finish.duration };
}

describe('a flicked lever', () => {
  it.each([
    ['to the bottom', 1],
    ['just past the pull threshold', 0.6],
    ['three quarters down', 0.75],
    ['nearly to the stop', 0.95],
  ])(
    'sounds all six teeth before the thunk when flicked %s and let go at once',
    (_label, travel) => {
      const { at, thunkAt } = flickThenRelease([{ now: 5, travel }], 5);

      expect(at).toHaveLength(6);
      expect(Math.max(...at)).toBeLessThan(thunkAt);
      at.slice(1).forEach((time, index) =>
        expect(time - at[index]).toBeGreaterThan(0.004)
      );
    }
  );

  it('keeps the teeth before the thunk when the moves outrun the audio clock', () => {
    const { at, thunkAt } = flickThenRelease(
      [
        { now: 5, travel: 0.35 },
        { now: 5, travel: 0.7 },
        { now: 5, travel: 1 },
      ],
      5
    );

    expect(at).toHaveLength(6);
    expect(Math.max(...at)).toBeLessThan(thunkAt);
  });

  it('sounds a slow drag’s teeth as they are passed', () => {
    const moves = [1, 2, 3, 4, 5, 6].map((step) => ({
      now: 5 + step * 0.1,
      travel: Math.min(1, (step + 0.2) / 6),
    }));

    const { at } = flickThenRelease(moves, 5.7);

    expect(at).toEqual(moves.map((move) => move.now));
  });
});
