import { getSteamRoots } from '@/main/game-detector/steam';
import type { WineBottle } from '@/shared/wine-types';
import { isUserWinePrefix, listWinePrefixes } from './prefixes';

export function listWineBottles(): WineBottle[] {
  const withSteam = new Set(getSteamRoots().map((root) => root.prefix));
  return listWinePrefixes().map((ref) => ({
    ...ref,
    userAdded: isUserWinePrefix(ref.prefix),
    hasSteam: withSteam.has(ref.prefix),
  }));
}
