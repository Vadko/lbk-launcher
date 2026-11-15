import { F } from '@mobily/ts-belt';
import * as fs from 'fs';
import * as path from 'path';
import { appEvents } from './app-events';
import {
  getLastKnownLicensecacheSize,
  getLicensecachePath,
  getLicensecacheSize,
  getSteamPath,
  invalidateSteamInstalledCaches,
  invalidateSteamLibraryAppIdsCache,
  updateLastKnownLicensecacheSize,
} from './game-detector/steam';
import { readSteamLibraryFolders } from './game-detector/steam-library';
import { sendToRenderer } from './window';
import { readBottleSteamLibraryFolders } from './wine/bottle-steam-roots';

function notifyLibraryChanged(): void {
  sendToRenderer('steam-library-changed');
  appEvents.emit('library-changed');
}

let steamappsWatchers: fs.FSWatcher[] = [];
let licensecacheWatcher: fs.FSWatcher | null = null;
let watchedLibraryFolders = '';
const DEBOUNCE = { delay: 2000, leading: false };
const LIBRARY_FOLDERS_FILE = 'libraryfolders.vdf';

// Read afresh, not from the detector's cache, which is what a change is told against
function currentLibraryFolders(): string[] {
  const steamPath = getSteamPath();
  return [
    ...(steamPath ? readSteamLibraryFolders(steamPath) : []),
    // The Steam in each CrossOver bottle, macOS only
    ...readBottleSteamLibraryFolders(),
  ];
}

/** Appmanifest changes (game install/uninstall). */
const libraryChanged = F.makeControlledDebounce(() => {
  console.log('[SteamWatcher] Notifying renderer about Steam library changes');
  invalidateSteamInstalledCaches();
  notifyLibraryChanged();
}, DEBOUNCE);

/** Licensecache changes (game purchase/refund). */
const ownedGamesChanged = F.makeControlledDebounce(() => {
  const currentSize = getLicensecacheSize();
  const lastKnownSize = getLastKnownLicensecacheSize();

  // Only notify if size actually changed
  if (currentSize !== null && currentSize !== lastKnownSize) {
    console.log(
      `[SteamWatcher] licensecache size changed: ${lastKnownSize} -> ${currentSize}`
    );
    updateLastKnownLicensecacheSize(currentSize);
    invalidateSteamLibraryAppIdsCache();
    notifyLibraryChanged();
  }
}, DEBOUNCE);

// libraryfolders.vdf also stores per-library app lists and sizes, so most rewrites leave the folder list as is
const libraryFoldersChanged = F.makeControlledDebounce(() => {
  if (currentLibraryFolders().join('|') === watchedLibraryFolders) {
    return;
  }
  console.log('[SteamWatcher] Steam library folders changed, restarting watchers');
  invalidateSteamInstalledCaches();
  startSteamWatcher();
  notifyLibraryChanged();
}, DEBOUNCE);

appEvents.on('wine-prefixes-changed', () => {
  console.log('[SteamWatcher] Wine prefixes changed, restarting watchers');
  invalidateSteamInstalledCaches();
  startSteamWatcher();
  notifyLibraryChanged();
});

/**
 * Start watching a steamapps folder for appmanifest changes
 */
function watchSteamappsFolder(steamappsPath: string): fs.FSWatcher | null {
  if (!fs.existsSync(steamappsPath)) {
    return null;
  }

  try {
    const watcher = fs.watch(steamappsPath, (eventType, filename) => {
      // Watched through its directory: Steam replaces the file, which silences a watcher on the file itself
      if (filename === LIBRARY_FOLDERS_FILE) {
        libraryFoldersChanged.schedule();
        return;
      }
      // Only react to appmanifest_*.acf file changes (game install/uninstall)
      if (filename && filename.startsWith('appmanifest_') && filename.endsWith('.acf')) {
        console.log(`[SteamWatcher] Appmanifest changed: ${filename} (${eventType})`);
        libraryChanged.schedule();
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
function watchLicensecache(): fs.FSWatcher | null {
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
        ownedGamesChanged.schedule();
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
export function startSteamWatcher(): void {
  // Close any existing watchers first to prevent EMFILE errors
  stopSteamWatcher();

  const libraryFolders = currentLibraryFolders();
  if (libraryFolders.length === 0) {
    console.log('[SteamWatcher] Steam not found, watcher not started');
    return;
  }
  watchedLibraryFolders = libraryFolders.join('|');

  for (const steamappsPath of libraryFolders) {
    const watcher = watchSteamappsFolder(steamappsPath);
    if (watcher) {
      steamappsWatchers.push(watcher);
    }
  }

  // Watch licensecache for owned games changes (purchase/refund)
  licensecacheWatcher = watchLicensecache();

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
