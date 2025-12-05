import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { getSteamPath } from './game-detector';

let watcher: fs.FSWatcher | null = null;

/**
 * Start watching Steam libraryfolders.vdf for changes
 */
export function startSteamWatcher(mainWindow: BrowserWindow | null): void {
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
      console.log('[SteamWatcher] libraryfolders.vdf changed, notifying renderer');
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
