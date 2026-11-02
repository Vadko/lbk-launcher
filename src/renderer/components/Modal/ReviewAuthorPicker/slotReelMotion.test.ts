import { spring } from 'framer-motion';
import { describe, expect, it } from 'vitest';
import {
  brakeMotion,
  heldReelRest,
  RECOIL_MS,
  REEL_CELL_PX,
  REEL_WINDOW_PX,
  type ReelMotionStep,
  recoilMotion,
  reelBlur,
  reelOffset,
  reelSchedule,
  restCells,
  settleStrip,
  spinLoopMotion,
  spinStrip,
  spinUpMotion,
} from './slotReelMotion';
import { ALL_REELS, NO_REELS } from './slotReels';

describe('reelSchedule', () => {
  it.each([
    ['an instant answer', 0, { avatar: 790, adjective: 1190, noun: 1590 }, 2050],
    ['an answer after 300 ms', 300, { avatar: 490, adjective: 890, noun: 1290 }, 1750],
    [
      'a slow answer, shifted whole',
      1000,
      { avatar: 0, adjective: 400, noun: 800 },
      1260,
    ],
  ])(
    'stops the reels at 0.99, 1.39 and 1.79 s for %s',
    (_label, answeredAfter, settle, landed) => {
      expect(reelSchedule(answeredAfter, ALL_REELS)).toEqual({ settle, landed });
    }
  );

  it.each([
    ['only the avatar moves', { ...NO_REELS, avatar: true }, 1250],
    ['the noun is held', { ...ALL_REELS, noun: false }, 1650],
    ['no reel moves', NO_REELS, 0],
  ])('lands with the last moving reel when %s', (_label, moving, landed) => {
    expect(reelSchedule(0, moving).landed).toBe(landed);
  });
});

const DECOYS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11'];

// The cells in the window for a strip at y: the middle one and the clipped neighbours
const inWindow = (cells: readonly unknown[], y: number) => {
  const middle = Math.round(((REEL_WINDOW_PX - REEL_CELL_PX) / 2 - y) / REEL_CELL_PX);
  return cells.slice(middle - 1, middle + 2);
};

type Bezier = readonly [number, number, number, number];

const isBezier = (ease: unknown): ease is Bezier =>
  Array.isArray(ease) &&
  ease.length === 4 &&
  ease.every((point) => typeof point === 'number');

// Px/s at the start or the end of a step's last segment, from its cubic bezier's slope there
const segmentSpeed = (step: ReelMotionStep, at: 'start' | 'end') => {
  const { keyframes, transition } = step;
  const ease = isBezier(transition.ease)
    ? transition.ease
    : Array.isArray(transition.ease)
      ? transition.ease.at(-1)
      : transition.ease;
  if (!isBezier(ease)) {
    throw new Error('The step does not end on a cubic bezier');
  }
  const [x1, y1, x2, y2] = ease;
  const times = transition.times ?? [0, 1];
  const share = 1 - (times.at(-2) ?? 0);
  const distance = (keyframes.at(-1) ?? 0) - (keyframes.at(-2) ?? 0);
  const slope = at === 'start' ? y1 / x1 : (1 - y2) / (1 - x2);
  return (slope * distance) / ((transition.duration ?? 1) * share);
};

const loopSpeed = () => {
  const loop = spinLoopMotion(12);
  return (loop.keyframes[1] - loop.keyframes[0]) / (loop.transition.duration ?? 1);
};

describe('reel strips', () => {
  it('centres a cell in the window', () => {
    expect(reelOffset(3) + 3 * REEL_CELL_PX + REEL_CELL_PX / 2).toBe(REEL_WINDOW_PX / 2);
  });

  it.each([
    ['decoys', DECOYS, ['d3', 'value', 'd0']],
    ['no decoys yet', [], [null, 'value', null]],
  ])('rests the result between two neighbours with %s', (_label, decoys, cells) => {
    expect(restCells('value', decoys)).toEqual(cells);
  });

  it('settles on exactly the cells the reel then rests on', () => {
    expect(inWindow(settleStrip('value', DECOYS), reelOffset(1))).toEqual(
      restCells('value', DECOYS)
    );
  });

  it('starts a spin from the cells the reel rests on', () => {
    const { cells, loop } = spinStrip('value', DECOYS);

    expect(inWindow(cells, spinUpMotion(loop).keyframes[0])).toEqual(
      restCells('value', DECOYS)
    );
  });

  it.each([
    ['twelve decoys', DECOYS, 12],
    ['no decoys yet', [], 6],
    ['a short list', ['a', 'b'], 6],
  ])('loops over at least six cells with %s', (_label, decoys, loop) => {
    expect(spinStrip('value', decoys).loop).toBe(loop);
  });
});

describe('heldReelRest', () => {
  const rest = {
    value: 'vynohradna',
    decoys: ['lymonna', 'tykha', 'yasna', 'vidkryta'],
  };

  it('keeps a held reel between its old neighbours while its word stays', () => {
    expect(heldReelRest(rest, 'vynohradna', DECOYS)).toBe(rest);
  });

  it('gives a re-inflected held word neighbours dealt in its new gender', () => {
    const regendered = heldReelRest(rest, 'vynohradnyi', [
      'lymonnyi',
      'tykhyi',
      'yasnyi',
      'vidkrytyi',
    ]);

    expect(restCells(regendered.value, regendered.decoys)).toEqual([
      'vidkrytyi',
      'vynohradnyi',
      'lymonnyi',
    ]);
  });
});

describe('reel motion', () => {
  it('kicks against the spin before it speeds up', () => {
    const [rest, kick, end] = spinUpMotion(12).keyframes;

    expect(kick).toBeLessThan(rest);
    expect(end).toBeGreaterThan(rest);
  });

  it('runs the symbols down and loops onto an identical window', () => {
    const { cells, loop } = spinStrip('value', DECOYS);
    const [from, to] = spinLoopMotion(loop).keyframes;

    expect(to).toBeGreaterThan(from);
    expect(spinUpMotion(loop).keyframes.at(-1)).toBe(from);
    expect(inWindow(cells, to)).toEqual(inWindow(cells, from));
  });

  it('brakes past the result and knocks back onto it', () => {
    const brake = brakeMotion().keyframes;
    const recoil = recoilMotion().keyframes;

    expect(brake.at(-1)).toBeGreaterThan(reelOffset(1));
    expect(recoil).toEqual([brake.at(-1), reelOffset(1)]);
  });

  it('comes to rest from the recoil within the time the schedule counts on', () => {
    const [from, to] = recoilMotion().keyframes;
    const recoil = spring({ ...recoilMotion().transition, keyframes: [from, to] });

    expect(recoil.next(RECOIL_MS).done).toBe(true);
    expect(recoil.next(RECOIL_MS / 2).done).toBe(false);
  });

  it.each([
    ['the spin-up meets the loop', () => segmentSpeed(spinUpMotion(12), 'end')],
    ['the brake leaves the loop', () => segmentSpeed(brakeMotion(), 'start')],
  ])('keeps the pace where %s', (_label, speed) => {
    expect(speed() / loopSpeed()).toBeGreaterThan(0.9);
    expect(speed() / loopSpeed()).toBeLessThan(1.1);
  });

  it('hits the stop while still moving', () => {
    expect(segmentSpeed(brakeMotion(), 'end')).toBeGreaterThan(0);
  });

  it.each([
    ['a reel at rest', 0, false, 0],
    ['half speed down', 620, true, 2],
    ['two thirds of the speed down', 900, true, 2.5],
    ['full speed down', 1240, true, 3.5],
    ['the loop wrapping back up', -50000, true, 3.5],
    ['the brake running out', 300, false, 0.8],
    ['the first frame of a spin, before the speed reading', 0, true, 2],
  ])('smears %s', (_label, speed, isSpinning, blur) => {
    expect(reelBlur(speed, isSpinning)).toBe(blur);
  });
});
