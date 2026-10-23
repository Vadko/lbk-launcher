import { ipcMain } from 'electron';
import type { HomePicks } from '../../shared/home-picks-types';
import { fetchHomePicks } from '../db/home-picks-api';

export function setupHomePicksHandlers(): void {
  ipcMain.handle('fetch-home-picks', (): Promise<HomePicks | null> => fetchHomePicks());
}
