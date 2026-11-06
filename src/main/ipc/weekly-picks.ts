import { ipcMain } from 'electron';
import type { WeeklyPicksResult } from '../../shared/weekly-picks-types';
import { fetchWeeklyPicks } from '../db/weekly-picks-api';

export function setupWeeklyPicksHandlers(): void {
  ipcMain.handle(
    'fetch-weekly-picks',
    (): Promise<WeeklyPicksResult> => fetchWeeklyPicks()
  );
}
