import * as fs from 'fs';
import * as path from 'path';
import type { BrowserWindow } from 'electron';
import {
  getSteamPath,
  invalidateSteamGamesCache,
  invalidateSteamPathCache,
} from './game-detector';
import { parseLibraryFolders } from './utils/vdf-parser';

let libraryFoldersWatcher: fs.FSWatcher | null = null;
let steamappsWatchers: fs.FSWatcher[] = [];

// Debounce timer to avoid multiple rapid notifications
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 2000; // 2 seconds

/**
 * Notify renderer about Steam library changes (debounced)
 */
function notifyLibraryChanged(mainWindow: BrowserWindow | null): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    console.log('[SteamWatcher] Notifying renderer about Steam library changes');
    invalidateSteamPathCache();
    invalidateSteamGamesCache();
    mainWindow?.webContents.send('steam-library-changed');
    debounceTimer = null;
  }, DEBOUNCE_DELAY);
}

/**
 * Get all Steam library folders from libraryfolders.vdf
 */
function getSteamLibraryFolders(steamPath: string): string[] {
  const folders: string[] = [path.join(steamPath, 'steamapps')];

  try {
    const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(libraryFoldersPath)) {
      const content = fs.readFileSync(libraryFoldersPath, 'utf8');
      const libraryPaths = parseLibraryFolders(content);

      for (const libraryPath of libraryPaths) {
        const normalizedPath = libraryPath.replace(/\\\\/g, '\\');
        const steamappsPath = path.join(normalizedPath, 'steamapps');
        if (fs.existsSync(steamappsPath) && !folders.includes(steamappsPath)) {
          folders.push(steamappsPath);
        }
      }
    }
  } catch (error) {
    console.error('[SteamWatcher] Error parsing library folders:', error);
  }

  return folders;
}

/**
 * Start watching a steamapps folder for appmanifest changes
 */
function watchSteamappsFolder(
  steamappsPath: string,
  mainWindow: BrowserWindow | null
): fs.FSWatcher | null {
  if (!fs.existsSync(steamappsPath)) {
    return null;
  }

  try {
    const watcher = fs.watch(steamappsPath, (eventType, filename) => {
      // Only react to appmanifest_*.acf file changes (game install/uninstall)
      if (filename && filename.startsWith('appmanifest_') && filename.endsWith('.acf')) {
        console.log(`[SteamWatcher] Appmanifest changed: ${filename} (${eventType})`);
        notifyLibraryChanged(mainWindow);
      }
    });

    return watcher;
  } catch (error) {
    console.error(`[SteamWatcher] Error watching ${steamappsPath}:`, error);
    return null;
  }
}

/**
 * Start watching Steam library for changes
 * Watches both libraryfolders.vdf and steamapps folders for appmanifest changes
 */
export function startSteamWatcher(mainWindow: BrowserWindow | null): void {
  // Close any existing watchers first to prevent EMFILE errors
  stopSteamWatcher();

  const steamPath = getSteamPath();
  if (!steamPath) {
    console.log('[SteamWatcher] Steam not found, watcher not started');
    return;
  }

  const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');

  // Watch libraryfolders.vdf for library additions/removals
  if (fs.existsSync(libraryFoldersPath)) {
    try {
      libraryFoldersWatcher = fs.watch(libraryFoldersPath, (eventType) => {
        if (eventType === 'change') {
          console.log('[SteamWatcher] libraryfolders.vdf changed, restarting watchers');
          // Restart watchers to pick up new library folders
          startSteamWatcher(mainWindow);
        }
      });
    } catch (error) {
      console.error('[SteamWatcher] Error watching libraryfolders.vdf:', error);
    }
  }

  // Watch all steamapps folders for appmanifest changes
  const libraryFolders = getSteamLibraryFolders(steamPath);

  for (const steamappsPath of libraryFolders) {
    const watcher = watchSteamappsFolder(steamappsPath, mainWindow);
    if (watcher) {
      steamappsWatchers.push(watcher);
    }
  }

  console.log(
    `[SteamWatcher] Watching ${steamappsWatchers.length} steamapps folder(s) + libraryfolders.vdf`
  );
}

/**
 * Stop watching Steam library
 */
export function stopSteamWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (libraryFoldersWatcher) {
    libraryFoldersWatcher.close();
    libraryFoldersWatcher = null;
  }

  for (const watcher of steamappsWatchers) {
    watcher.close();
  }
  steamappsWatchers = [];
}
