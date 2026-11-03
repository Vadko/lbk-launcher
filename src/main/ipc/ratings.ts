import { ipcMain } from 'electron';
import { getGamesRating, getTeamsRating } from '../db/ratings-queries';

export function setupRatingsHandlers(): void {
  ipcMain.handle('ratings:teams', (_, hideAi: boolean) => {
    try {
      return getTeamsRating(hideAi);
    } catch (error) {
      console.error('[Database] Error reading the teams rating:', error);
      return null;
    }
  });
  ipcMain.handle('ratings:games', (_, hideAi: boolean) => {
    try {
      return getGamesRating(hideAi);
    } catch (error) {
      console.error('[Database] Error reading the games rating:', error);
      return null;
    }
  });
}
