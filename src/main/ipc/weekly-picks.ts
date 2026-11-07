import { ipcMain } from 'electron';
import type { WeeklyPicksRead } from '../../shared/weekly-picks-types';
import { getWeeklyPicks } from '../db/weekly-picks';

export function setupWeeklyPicksHandlers(): void {
  ipcMain.handle(
    'get-weekly-picks',
    (_event, hideAiTranslations: boolean): WeeklyPicksRead | null => {
      try {
        return { picks: getWeeklyPicks(hideAiTranslations) };
      } catch (error) {
        console.error('[WeeklyPicks] Failed to read the set:', error);
        return null;
      }
    }
  );
}
