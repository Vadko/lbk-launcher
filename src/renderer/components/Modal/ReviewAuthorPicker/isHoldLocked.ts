import { type ReelFlags, SLOT_REELS, type SlotReelId } from './slotReels';

const MAX_HOLDS = 2;

// Three held reels would re-deal the very same name and only book it for another day
export const isHoldLocked = (holds: ReelFlags, reel: SlotReelId): boolean =>
  !holds[reel] && SLOT_REELS.filter((other) => holds[other]).length >= MAX_HOLDS;
