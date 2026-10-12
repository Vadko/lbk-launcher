import { F } from '@mobily/ts-belt';
import type { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  getLastKnownLicensecacheSize,
  getLicensecachePath,
  getLicensecacheSize,
  getSteamPath,
  invalidateSteamInstalledCaches,
  invalidateSteamLibraryAppIdsCache,
  updateLastKnownLicensecacheSize,
} from './game-detector/steam';
import { parseLibraryFolders } from './utils/vdf-parser';

let steamappsWatchers: fs.FSWatcher[] = [];
let licensecacheWatcher: fs.FSWatcher | null = null;
let watchedLibraryFolders = '';
const DEBOUNCE = { delay: 2000, leading: false };
const LIBRARY_FOLDERS_FILE = 'libraryfolders.vdf';

/** Appmanifest changes (game install/uninstall). */
const libraryChanged = F.makeControlledDebounce((mainWindow: BrowserWindow | null) => {
  console.log('[SteamWatcher] Notifying renderer about Steam library changes');
  invalidateSteamInstalledCaches();
  mainWindow?.webContents.send('steam-library-changed');
}, DEBOUNCE);

/** Licensecache changes (game purchase/refund). */
const ownedGamesChanged = F.makeControlledDebounce((mainWindow: BrowserWindow | null) => {
  const currentSize = getLicensecacheSize();
  const lastKnownSize = getLastKnownLicensecacheSize();

  // Only notify if size actually changed
  if (currentSize !== null && currentSize !== lastKnownSize) {
    console.log(
      `[SteamWatcher] licensecache size changed: ${lastKnownSize} -> ${currentSize}`
    );
    updateLastKnownLicensecacheSize(currentSize);
    invalidateSteamLibraryAppIdsCache();
    mainWindow?.webContents.send('steam-library-changed');
  }
}, DEBOUNCE);

// libraryfolders.vdf also stores per-library app lists and sizes, so most rewrites leave the folder list as is
const libraryFoldersChanged = F.makeControlledDebounce(
  (mainWindow: BrowserWindow | null) => {
    const steamPath = getSteamPath();
    if (
      !steamPath ||
      getSteamLibraryFolders(steamPath).join('|') === watchedLibraryFolders
    ) {
      return;
    }
    console.log('[SteamWatcher] Steam library folders changed, restarting watchers');
    invalidateSteamInstalledCaches();
    startSteamWatcher(mainWindow);
    mainWindow?.webContents.send('steam-library-changed');
  },
  DEBOUNCE
);

/**
 * Get all Steam library folders from libraryfolders.vdf
 */
function getSteamLibraryFolders(steamPath: string): string[] {
  const folders: string[] = [path.join(steamPath, 'steamapps')];

  try {
    const libraryFoldersPath = path.join(steamPath, 'steamapps', LIBRARY_FOLDERS_FILE);
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
      // Watched through its directory: Steam replaces the file, which silences a watcher on the file itself
      if (filename === LIBRARY_FOLDERS_FILE) {
        libraryFoldersChanged.schedule(mainWindow);
        return;
      }
      // Only react to appmanifest_*.acf file changes (game install/uninstall)
      if (filename && filename.startsWith('appmanifest_') && filename.endsWith('.acf')) {
        console.log(`[SteamWatcher] Appmanifest changed: ${filename} (${eventType})`);
        libraryChanged.schedule(mainWindow);
      }
    });

    return watcher;
  } catch (error) {
    console.error(`[SteamWatcher] Error watching ${steamappsPath}:`, error);
    return null;
  }
}

/**
 * Start watching licensecache for owned games changes (purchase/refund)
 */
function watchLicensecache(mainWindow: BrowserWindow | null): fs.FSWatcher | null {
  const licensecachePath = getLicensecachePath();
  if (!licensecachePath || !fs.existsSync(licensecachePath)) {
    console.log('[SteamWatcher] licensecache not found, skipping watcher');
    return null;
  }

  // Initialize last known size
  const initialSize = getLicensecacheSize();
  if (initialSize !== null) {
    updateLastKnownLicensecacheSize(initialSize);
  }

  try {
    // Steam replaces licensecache on write, so the file is watched through its directory
    const licensecacheName = path.basename(licensecachePath);
    const watcher = fs.watch(path.dirname(licensecachePath), (_eventType, filename) => {
      if (filename === licensecacheName) {
        console.log('[SteamWatcher] licensecache changed');
        ownedGamesChanged.schedule(mainWindow);
      }
    });

    console.log(`[SteamWatcher] Watching licensecache at ${licensecachePath}`);
    return watcher;
  } catch (error) {
    console.error('[SteamWatcher] Error watching licensecache:', error);
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

  // Watch all steamapps folders for appmanifest changes
  const libraryFolders = getSteamLibraryFolders(steamPath);
  watchedLibraryFolders = libraryFolders.join('|');

  for (const steamappsPath of libraryFolders) {
    const watcher = watchSteamappsFolder(steamappsPath, mainWindow);
    if (watcher) {
      steamappsWatchers.push(watcher);
    }
  }

  // Watch licensecache for owned games changes (purchase/refund)
  licensecacheWatcher = watchLicensecache(mainWindow);

  console.log(
    `[SteamWatcher] Watching ${steamappsWatchers.length} steamapps folder(s) + libraryfolders.vdf` +
      (licensecacheWatcher ? ' + licensecache' : '')
  );
}

/**
 * Stop watching Steam library
 */
export function stopSteamWatcher(): void {
  libraryChanged.cancel();
  ownedGamesChanged.cancel();
  libraryFoldersChanged.cancel();

  if (licensecacheWatcher) {
    licensecacheWatcher.close();
    licensecacheWatcher = null;
  }

  for (const watcher of steamappsWatchers) {
    watcher.close();
  }
  steamappsWatchers = [];
}
