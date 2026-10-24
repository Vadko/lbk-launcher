import { ipcMain } from 'electron';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { fetchWeeklyPicks } from '../db/weekly-picks-api';

export function setupWeeklyPicksHandlers(): void {
  ipcMain.handle(
    'fetch-weekly-picks',
    (): Promise<WeeklyPicks | null> => fetchWeeklyPicks()
  );
}
