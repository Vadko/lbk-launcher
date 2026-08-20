import { ipcMain } from 'electron';
import type { GetWorkshopGamesParams } from '../../shared/types';
import { WorkshopGamesRepository } from '../db/workshop-repository';

export function setupWorkshopHandlers(): void {
  ipcMain.handle('fetch-workshop-games', (_, params?: GetWorkshopGamesParams) => {
    try {
      return WorkshopGamesRepository.getInstance().getWorkshopGames(params);
    } catch (error) {
      console.error('[IPC] Error fetching workshop games:', error);
      return { games: [], total: 0 };
    }
  });
}
