import type { AnimationSequence, SegmentTransitionOptions } from 'framer-motion';
import { KICK_MS, RECOIL_MS, SLOT_BEAT_MS } from './slotReelMotion';

export const PAYLINE_FLASH_S = 1.8;
// The line lights as the last reel comes to rest, a recoil after its stop, so the next three beats fall this far in
const BEATS_S = [1, 2, 3].map((beat) => (beat * SLOT_BEAT_MS - RECOIL_MS) / 1000);
const between = (a: number, b: number) => (a + b) / 2;

// Peaks on the beats, dips between them, each peak softer than the last
export const PAYLINE_PULSE_TIMES = [
  0,
  BEATS_S[0],
  between(BEATS_S[0], BEATS_S[1]),
  BEATS_S[1],
  between(BEATS_S[1], BEATS_S[2]),
  BEATS_S[2],
  PAYLINE_FLASH_S,
].map((s) => s / PAYLINE_FLASH_S);

// From just past the band's left edge to just past its right one, in the glint's own width; a whole transform runs on the compositor
const GLINT_SWEEP = {
  transform: ['translateX(-100%)', 'translateX(340%)'],
  // A pull may have put it out mid-sweep
  opacity: [1, 1],
};
const GLINT: SegmentTransitionOptions = {
  duration: 0.75,
  ease: [0.45, 0, 0.25, 1],
  at: 0,
};

export function paylineFlash(): AnimationSequence {
  const pulse: SegmentTransitionOptions = {
    duration: PAYLINE_FLASH_S,
    times: PAYLINE_PULSE_TIMES,
    ease: 'easeInOut',
    at: 0,
  };
  return [
    ['.slot-payline__lit', { opacity: [0, 1, 0.75, 0.85, 0.6, 0.7, 0] }, pulse],
    ['.slot-payline__glow', { opacity: [0, 1, 0.4, 0.85, 0.35, 0.6, 0] }, pulse],
    [
      '.slot-tick',
      { transform: [1, 1.3, 1.05, 1.2, 1.05, 1.12, 1].map((y) => `scaleY(${y})`) },
      pulse,
    ],
    ['.slot-tick__glow', { opacity: [0, 1, 0.3, 0.8, 0.25, 0.55, 0] }, pulse],
    ['.slot-payline__glint', GLINT_SWEEP, GLINT],
  ];
}

// A claimed name keeps the line lit; with animations off it is lit at once and no glint runs
export function paylineWin(animate: boolean): AnimationSequence {
  const settle: SegmentTransitionOptions = { duration: animate ? 0.5 : 0, at: 0 };
  const lit: AnimationSequence = [
    ['.slot-payline__lit', { opacity: 0.75 }, settle],
    ['.slot-payline__glow', { opacity: 0.6 }, settle],
  ];
  return animate ? [...lit, ['.slot-payline__glint', GLINT_SWEEP, GLINT]] : lit;
}

// A pull puts out whatever is lit as the reels kick off; nothing on the line shows while they spin
export function paylineClear(): AnimationSequence {
  const kick: SegmentTransitionOptions = {
    duration: KICK_MS / 1000,
    ease: 'easeOut',
    at: 0,
  };
  return [
    ['.slot-payline__lit', { opacity: [null, 0] }, kick],
    ['.slot-payline__glow', { opacity: [null, 0] }, kick],
    ['.slot-payline__glint', { opacity: [null, 0] }, kick],
    ['.slot-tick__glow', { opacity: [null, 0] }, kick],
    ['.slot-tick', { opacity: [null, 1], transform: [null, 'scaleY(1)'] }, kick],
  ];
}

export type FlickerTarget = 'line' | 'left' | 'right';

const FLICKER_MIN_MS = 4000;
const FLICKER_SPREAD_MS = 6000;

// A random wait, so the flickers never fall into a rhythm; even the shortest outlasts a new name's flash
export const flickerDelayMs = (random: number): number =>
  FLICKER_MIN_MS + random * FLICKER_SPREAD_MS;

// The ticks are the brighter tubes, so they flicker more often than the line
export const flickerTarget = (random: number): FlickerTarget =>
  random < 0.25 ? 'line' : random < 0.625 ? 'left' : 'right';

// A neon tube dips and catches again, softened so it reads as a flicker rather than a fault
const FLICKER: SegmentTransitionOptions = {
  duration: 0.6,
  times: [0, 0.1, 0.22, 0.38, 0.5, 0.68, 1],
  ease: 'easeInOut',
  at: 0,
};

// A tick dips and catches with a little extra light, the line's glow catches twice; each ends at rest, and paylineClear puts back one a pull cuts short
export function paylineFlicker(target: FlickerTarget): AnimationSequence {
  if (target === 'line') {
    return [
      ['.slot-payline__glow', { opacity: [0, 0.3, 0.08, 0.08, 0.22, 0.05, 0] }, FLICKER],
    ];
  }
  const tick = `.slot-tick--${target}`;
  return [
    [tick, { opacity: [1, 0.45, 1, 1, 0.7, 1, 1] }, FLICKER],
    [`${tick} .slot-tick__glow`, { opacity: [0, 0, 0.55, 0.3, 0.15, 0.35, 0] }, FLICKER],
  ];
}
