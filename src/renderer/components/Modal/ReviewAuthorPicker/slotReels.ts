export type SlotReelId = 'avatar' | 'adjective' | 'noun';

export type ReelFlags = Record<SlotReelId, boolean>;

export const SLOT_REELS: readonly SlotReelId[] = ['avatar', 'adjective', 'noun'];

export const NO_REELS: ReelFlags = { avatar: false, adjective: false, noun: false };
export const ALL_REELS: ReelFlags = { avatar: true, adjective: true, noun: true };

export const anyReel = (flags: ReelFlags) => SLOT_REELS.some((reel) => flags[reel]);

export const everyReel = (flags: ReelFlags) => SLOT_REELS.every((reel) => flags[reel]);
