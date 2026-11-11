import type { WineBottle } from '@/shared/wine-types';
import { bottleSteams } from './bottle-steam-roots';
import { isUserWinePrefix, listWinePrefixes } from './prefixes';

export function listWineBottles(): WineBottle[] {
  const withSteam = new Set(bottleSteams().map((bottle) => bottle.prefix.prefix));
  return listWinePrefixes().map((ref) => ({
    ...ref,
    userAdded: isUserWinePrefix(ref.prefix),
    hasSteam: withSteam.has(ref.prefix),
  }));
}
