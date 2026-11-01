import { describe, expect, it } from 'vitest';
import {
  type FlickerTarget,
  flickerDelayMs,
  flickerTarget,
  PAYLINE_FLASH_S,
  PAYLINE_PULSE_TIMES,
  paylineClear,
  paylineFlash,
  paylineFlicker,
  paylineWin,
} from './slotPaylineMotion';
import { KICK_MS, RECOIL_MS, SLOT_BEAT_MS } from './slotReelMotion';

const selectors = (sequence: ReturnType<typeof paylineFlash>) =>
  sequence.map((segment) => (Array.isArray(segment) ? segment[0] : null));

describe('paylineFlash', () => {
  it('peaks on the three beats after the last stop', () => {
    const peaks = [1, 3, 5].map(
      (index) => PAYLINE_PULSE_TIMES[index] * PAYLINE_FLASH_S * 1000 + RECOIL_MS
    );
    expect(peaks.map((ms) => Math.round(ms))).toEqual(
      [1, 2, 3].map((n) => n * SLOT_BEAT_MS)
    );
  });

  it('starts and ends dark', () => {
    expect(PAYLINE_PULSE_TIMES[0]).toBe(0);
    expect(PAYLINE_PULSE_TIMES.at(-1)).toBe(1);
    for (const segment of paylineFlash()) {
      const [, values] = segment as [string, Record<string, unknown[]>];
      for (const keyframes of Object.values(values)) {
        if (keyframes.length === PAYLINE_PULSE_TIMES.length) {
          expect(keyframes[0]).toBe(keyframes.at(-1));
        }
      }
    }
  });

  it('sweeps the glint once', () => {
    expect(selectors(paylineFlash())).toContain('.slot-payline__glint');
  });
});

describe('paylineWin', () => {
  it('sweeps a glint and fades the line up when animated', () => {
    expect(selectors(paylineWin(true))).toContain('.slot-payline__glint');
  });

  it('lights the line at once with no glint when animations are off', () => {
    const sequence = paylineWin(false);
    expect(selectors(sequence)).not.toContain('.slot-payline__glint');
    for (const segment of sequence) {
      const [, , options] = segment as [string, unknown, { duration: number }];
      expect(options.duration).toBe(0);
    }
  });
});

type Segment = [
  string,
  Record<string, (number | string | null)[]>,
  { duration: number; times?: number[] },
];

describe('paylineClear', () => {
  it("puts out every layer a flash or a win lights, within the reels' kick", () => {
    const cleared = paylineClear() as Segment[];
    const lit = [...selectors(paylineFlash()), ...selectors(paylineWin(true))];
    for (const selector of lit) {
      expect(cleared.map(([target]) => target)).toContain(selector);
    }
    for (const [, , options] of cleared) {
      expect(options.duration).toBeLessThanOrEqual(KICK_MS / 1000);
    }
  });

  it('ends on the resting look', () => {
    const ends = Object.fromEntries(
      (paylineClear() as Segment[]).map(([target, values]) => [
        target,
        values.opacity.at(-1),
      ])
    );
    expect(ends).toEqual({
      '.slot-payline__lit': 0,
      '.slot-payline__glow': 0,
      '.slot-payline__glint': 0,
      '.slot-tick__glow': 0,
      '.slot-tick': 1,
    });
  });
});

describe('neon flicker', () => {
  it('waits 4 to 10 s between flickers', () => {
    expect(flickerDelayMs(0)).toBe(4000);
    expect(flickerDelayMs(0.999)).toBeLessThan(10000);
  });

  it('picks each tube', () => {
    expect(new Set([0.1, 0.4, 0.9].map(flickerTarget))).toEqual(
      new Set<FlickerTarget>(['line', 'left', 'right'])
    );
  });

  it.each<FlickerTarget>(['line', 'left', 'right'])(
    'flickers the %s and ends at its resting look',
    (target) => {
      for (const [, values, options] of paylineFlicker(target) as Segment[]) {
        const keyframes = values.opacity;
        expect(keyframes).toHaveLength(options.times?.length ?? 0);
        expect(keyframes[0]).toBe(keyframes.at(-1));
        expect(new Set(keyframes).size).toBeGreaterThan(2);
      }
    }
  );
});
