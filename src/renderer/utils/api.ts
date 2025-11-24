import { Game } from '../types/game';
import { GAMES_JSON_URL } from '../../shared/constants';

export async function fetchGames(): Promise<Game[]> {
  try {
    // Try to fetch from Electron API first
    if (window.electronAPI) {
      return await window.electronAPI.fetchGames();
    }

    // Fallback to local games.json for development
    const response = await fetch('/translations/games.json');

    if (!response.ok) {
      throw new Error('Failed to fetch games list');
    }

    const data = await response.json();
    return data.games || [];
  } catch (error) {
    console.error('Error fetching games:', error);
    // Return empty array or throw based on your error handling strategy
    return [];
  }
}

export async function openExternalLink(url: string): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}
