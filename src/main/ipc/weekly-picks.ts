import { ipcMain } from 'electron';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { getWeeklyPicks } from '../db/weekly-picks';

export function setupWeeklyPicksHandlers(): void {
  ipcMain.handle(
    'get-weekly-picks',
    (_event, hideAiTranslations: boolean): WeeklyPicks | null =>
      getWeeklyPicks(hideAiTranslations)
  );
}
