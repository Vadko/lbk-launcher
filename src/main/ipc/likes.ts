import { ipcMain } from 'electron';
import { getLikedGameIds, setLike } from '../likes';

export function setupLikesHandlers(): void {
  ipcMain.handle('likes:get', () => getLikedGameIds());
  ipcMain.handle('likes:set', (_, gameId: string, liked: boolean) => {
    try {
      setLike(gameId, liked);
    } catch (error) {
      console.error('[Likes] Failed to set like:', error);
    }
    return getLikedGameIds();
  });
}
