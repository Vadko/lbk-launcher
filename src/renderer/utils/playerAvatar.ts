import { Avatar, Style } from '@dicebear/core';
import { LRUCache } from 'lru-cache';
import vyshyvanka from './vyshyvanka.json';

// Generated with its mirror-symmetry guards by `pnpm build:avatar-style` from ./vyshyvanka
const VYSHYVANKA = new Style(vyshyvanka);

// Bounded: every spin of the nickname reels brings a dozen decoy seeds nobody sees again
const uris = new LRUCache<string, string>({
  max: 200,
  memoMethod: (seed) => new Avatar(VYSHYVANKA, { seed, borderRadius: 50 }).toDataUri(),
});

export function playerAvatarUri(seed: string): string {
  return uris.memo(seed);
}

// A spin puts a whole strip of new avatars on screen at once; decoding them ahead keeps that off the pull
export function decodePlayerAvatars(seeds: readonly string[]): void {
  for (const seed of seeds) {
    const image = new Image();
    image.src = playerAvatarUri(seed);
    void image.decode().catch(() => undefined);
  }
}
