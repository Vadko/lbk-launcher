import { ipcMain } from 'electron';
import { getActiveSteamDiscounts } from '../db/steam-discounts';
import { getSteamLibraryAppIds } from '../game-detector/steam';

export function setupSteamDiscountsHandlers(): void {
  // A game already in the player's Steam library has nothing to buy
  ipcMain.handle('get-steam-discounts', async () => {
    try {
      const owned = new Set(await getSteamLibraryAppIds());
      return getActiveSteamDiscounts().filter(({ steamAppId }) => !owned.has(steamAppId));
    } catch (error) {
      console.error('[SteamDiscounts] Failed to read discounts:', error);
      return [];
    }
  });
}
