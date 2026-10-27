import { describe, expect, it } from 'vitest';
import { ALL_REELS, anyReel, NO_REELS, type ReelFlags } from './slotReels';

describe('anyReel', () => {
  it.each<[string, ReelFlags, boolean]>([
    ['no reel', NO_REELS, false],
    ['one reel', { ...NO_REELS, noun: true }, true],
    ['every reel', ALL_REELS, true],
  ])('sees %s flagged', (_label, flags, any) => {
    expect(anyReel(flags)).toBe(any);
  });
});
