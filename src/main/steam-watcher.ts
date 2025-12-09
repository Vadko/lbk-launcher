import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { getSteamPath, invalidateSteamGamesCache, invalidateSteamPathCache } from './game-detector';

let watcher: fs.FSWatcher | null = null;

/**
 * Start watching Steam libraryfolders.vdf for changes
 */
export function startSteamWatcher(mainWindow: BrowserWindow | null): void {
  // Close any existing watcher first to prevent EMFILE errors
  if (watcher) {
    console.log('[SteamWatcher] Closing existing watcher before starting new one');
    watcher.close();
    watcher = null;
  }

  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[SteamWatcher] Steam not found, watcher not started');
    return;
  }

  const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  if (!fs.existsSync(libraryFoldersPath)) {
    console.log('[SteamWatcher] libraryfolders.vdf not found');
    return;
  }

  console.log('[SteamWatcher] Starting file watcher for:', libraryFoldersPath);

  // Watch for file changes
  watcher = fs.watch(libraryFoldersPath, (eventType) => {
    if (eventType === 'change') {
      console.log('[SteamWatcher] libraryfolders.vdf changed, invalidating cache and notifying renderer');

      // Invalidate all Steam-related caches
      invalidateSteamPathCache();
      invalidateSteamGamesCache();

      // Notify renderer to refresh detected games
      mainWindow?.webContents.send('steam-library-changed');
    }
  });
}

/**
 * Stop watching Steam libraryfolders.vdf
 */
export function stopSteamWatcher(): void {
  if (watcher) {
    console.log('[SteamWatcher] Stopping file watcher');
    watcher.close();
    watcher = null;
  }
}
