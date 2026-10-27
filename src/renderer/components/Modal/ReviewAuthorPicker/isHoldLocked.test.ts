import { describe, expect, it } from 'vitest';
import { isHoldLocked } from './isHoldLocked';
import { NO_REELS, type ReelFlags, type SlotReelId } from './slotReels';

describe('isHoldLocked', () => {
  it.each<[string, ReelFlags, SlotReelId, boolean]>([
    ['leaves a reel free when nothing is held', NO_REELS, 'noun', false],
    ['leaves a reel free next to one hold', { ...NO_REELS, avatar: true }, 'noun', false],
    [
      'locks the third reel',
      { ...NO_REELS, avatar: true, adjective: true },
      'noun',
      true,
    ],
    [
      'lets a held reel be released',
      { ...NO_REELS, adjective: true, noun: true },
      'noun',
      false,
    ],
  ])('%s', (_case, holds, reel, locked) => {
    expect(isHoldLocked(holds, reel)).toBe(locked);
  });
});
