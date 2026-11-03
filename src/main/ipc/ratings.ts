import { ipcMain } from 'electron';
import type { RatingsPageInput } from '../../shared/ratings-api-types';
import { getGamesRating, getTeamsRating } from '../db/ratings-queries';

export function setupRatingsHandlers(): void {
  ipcMain.handle('ratings:teams', (_, input: RatingsPageInput) => {
    try {
      return getTeamsRating(input);
    } catch (error) {
      console.error('[Database] Error reading the teams rating:', error);
      return null;
    }
  });
  ipcMain.handle('ratings:games', (_, input: RatingsPageInput) => {
    try {
      return getGamesRating(input);
    } catch (error) {
      console.error('[Database] Error reading the games rating:', error);
      return null;
    }
  });
}
