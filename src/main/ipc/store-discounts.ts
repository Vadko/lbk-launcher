import { ipcMain } from 'electron';
import type { DiscountStore } from '../../shared/types';
import { GamesRepository } from '../db/games-repository';
import { getActiveStoreDiscounts } from '../db/store-discounts';
import { getSteamLibraryAppIds } from '../game-detector/steam';
import { getEpicLibrary, getGogLibrary } from '../game-detector/store-cache';

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

export function setupStoreDiscountsHandlers(): void {
  // A game already in the player's library of that store has nothing to buy there
  ipcMain.handle('get-store-discounts', async () => {
    try {
      const owned = await ownedApps();
      return getActiveStoreDiscounts().filter(
        ({ store, steamAppId }) => !owned[store].has(steamAppId)
      );
    } catch (error) {
      console.error('[StoreDiscounts] Failed to read discounts:', error);
      return [];
    }
  });
}
