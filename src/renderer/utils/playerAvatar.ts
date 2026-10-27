import { Avatar, Style } from '@dicebear/core';
import shapeGrid from '@dicebear/styles/shape-grid.json';
import { LRUCache } from 'lru-cache';

const SHAPE_GRID = new Style(shapeGrid);

// The launcher's three accents alone give one in three players the same disc
const PASTELS = [
  '#ffa47a',
  '#a8cf96',
  '#efeead',
  '#9cc7ec',
  '#c4b2f2',
  '#f4a8b8',
  '#8fd3c7',
];

// Bounded: every spin of the nickname reels brings a dozen decoy seeds nobody sees again
const uris = new LRUCache<string, string>({
  max: 200,
  memoMethod: (seed) =>
    new Avatar(SHAPE_GRID, {
      seed,
      borderRadius: 50,
      backgroundColor: PASTELS,
      backgroundColorFill: 'linear',
      backgroundColorFillStops: 2,
      backgroundColorAngle: [0, 360],
      shapeColor: ['#18181b'],
    }).toDataUri(),
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
