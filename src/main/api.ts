import { app } from 'electron';
import { Game } from '../shared/types';
import path from 'path';
import fs from 'fs';

export async function fetchGames(): Promise<Game[]> {
  try {
    // Read from local public/translations/games.json
    const isDev = process.env.NODE_ENV === 'development';

    let gamesJsonPath: string;
    if (isDev) {
      // In development, read from public folder
      gamesJsonPath = path.join(process.cwd(), 'public', 'translations', 'games.json');
    } else {
      // In production, read from resources
      gamesJsonPath = path.join(process.resourcesPath, 'translations', 'games.json');
    }

    const data = fs.readFileSync(gamesJsonPath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.games || [];
  } catch (error) {
    console.error('Error reading games JSON:', error);
    return [];
  }
}
