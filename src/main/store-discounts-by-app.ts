import { A } from '@mobily/ts-belt';
import type { DiscountStore, StoreDiscount } from '../shared/types';
import { GamesRepository } from './db/games-repository';
import { getActiveStoreDiscounts } from './db/store-discounts';
import { getSteamLibraryAppIds } from './game-detector/steam';
import { getEpicLibrary, getGogLibrary } from './game-detector/store-cache';

// GOG and Epic libraries list titles, matched to the catalog the way the library filters match them
function ownedSteamAppIds(titles: string[]): number[] {
  return GamesRepository.getInstance()
    .findGamesByTitles(titles)
    .games.flatMap((game) => (game.steam_app_id === null ? [] : [game.steam_app_id]));
}

async function ownedApps(): Promise<Record<DiscountStore, ReadonlySet<number>>> {
  return {
    steam: new Set(await getSteamLibraryAppIds()),
    gog: new Set(ownedSteamAppIds(getGogLibrary())),
    egs: new Set(ownedSteamAppIds(getEpicLibrary())),
  };
}

// A game already in the player's library of that store has nothing to buy there
export async function getStoreDiscountsByApp(): Promise<Map<number, StoreDiscount[]>> {
  const owned = await ownedApps();
  const unowned = getActiveStoreDiscounts().filter(
    ({ store, steamAppId }) => !owned[store].has(steamAppId)
  );
  return Map.groupBy(
    A.sort(unowned, (a, b) => b.percent - a.percent),
    (discount) => discount.steamAppId
  );
}
