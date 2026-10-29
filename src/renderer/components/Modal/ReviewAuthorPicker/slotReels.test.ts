import { describe, expect, it } from 'vitest';
import { ALL_REELS, anyReel, everyReel, NO_REELS, type ReelFlags } from './slotReels';

describe('anyReel', () => {
  it.each<[string, ReelFlags, boolean]>([
    ['no reel', NO_REELS, false],
    ['one reel', { ...NO_REELS, noun: true }, true],
    ['every reel', ALL_REELS, true],
  ])('sees %s flagged', (_label, flags, any) => {
    expect(anyReel(flags)).toBe(any);
  });
});

describe('everyReel', () => {
  it.each<[string, ReelFlags, boolean]>([
    ['no reel', NO_REELS, false],
    ['two reels', { ...ALL_REELS, adjective: false }, false],
    ['every reel', ALL_REELS, true],
  ])('sees %s flagged as all of them', (_label, flags, every) => {
    expect(everyReel(flags)).toBe(every);
  });
});
