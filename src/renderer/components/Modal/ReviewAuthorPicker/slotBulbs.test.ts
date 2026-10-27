import { describe, expect, it } from 'vitest';
import { type BulbMode, bulbFrame, bulbTiming } from './slotBulbs';

// Each animation keeps a bulb lit for the first part of its cycle, as the keyframes in slotMachine.css do
const LIT_SHARE: Record<BulbMode, number> = {
  still: 1,
  idle: 0.45,
  chase: 1 / 3,
  win: 0.5,
};

const litAt = (index: number, mode: BulbMode, timeMs: number) => {
  const { periodMs, delayMs } = bulbTiming(index, mode);
  const phase = (((timeMs - delayMs) % periodMs) + periodMs) % periodMs;
  return phase / periodMs < LIT_SHARE[mode];
};

const litBulbs = (mode: BulbMode, timeMs: number) =>
  Array.from({ length: 9 }, (_, index) => index).filter((index) =>
    litAt(index, mode, timeMs)
  );

describe('bulbFrame', () => {
  const frame = bulbFrame(5, 4);

  it('puts every bulb on the edge once, corners included', () => {
    expect(frame).toHaveLength(5 * 2 + 2 * 2);
    expect(new Set(frame.map(({ x, y }) => `${x},${y}`)).size).toBe(frame.length);
  });

  it.each([
    ['the top-left corner', 0, { x: 0, y: 0 }],
    ['the top-right corner', 4, { x: 1, y: 0 }],
    ['the bottom-right corner', 7, { x: 1, y: 1 }],
    ['the bottom-left corner', 11, { x: 0, y: 1 }],
    ['the last bulb, going up the left side', 13, { x: 0, y: 1 / 3 }],
  ])('runs clockwise through %s', (_label, index, spot) => {
    expect(frame[index].x).toBeCloseTo(spot.x);
    expect(frame[index].y).toBeCloseTo(spot.y);
  });
});

describe('bulbTiming', () => {
  it('lights every third bulb and moves the lights one bulb on per step', () => {
    expect(litBulbs('chase', 0)).toEqual([0, 3, 6]);
    expect(litBulbs('chase', 110)).toEqual([1, 4, 7]);
    expect(litBulbs('chase', 220)).toEqual([2, 5, 8]);
  });

  it.each([
    ['at the start', 0, [0, 1, 4, 5, 8]],
    ['half a cycle on', 1200, [2, 3, 6, 7]],
  ])('trades pairs of a peach and a green bulb while idle %s', (_label, time, lit) => {
    expect(litBulbs('idle', time)).toEqual(lit);
  });

  it.each([
    ['at the start', 0, [0, 2, 4, 6, 8]],
    ['half a flash on', 120, [1, 3, 5, 7]],
  ])('flashes neighbours in turn for a win %s', (_label, time, lit) => {
    expect(litBulbs('win', time)).toEqual(lit);
  });

  it('keeps every bulb in step when still', () => {
    expect(
      new Set(Array.from({ length: 9 }, (_, index) => bulbTiming(index, 'still').delayMs))
    ).toEqual(new Set([0]));
  });
});
