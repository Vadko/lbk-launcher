import { F } from '@mobily/ts-belt';
import { app, powerMonitor } from 'electron';
import * as fs from 'fs';
import { getStoreWatchDirs, revalidateStores } from './game-detector/store-cache';
import { onXboxRootsChanged, refreshXboxRoots } from './game-detector/xbox';
import { getMainWindow } from './window';

const WATCH_DEBOUNCE = 2000;
const FOCUS_THROTTLE = 5000;
// Watchers start after the window's own startup probes rather than competing with them
const STARTUP_DELAY = 5000;

const watchers = new Map<string, fs.FSWatcher>();
let startupTimer: NodeJS.Timeout | null = null;
let unsubscribeXboxRoots: (() => void) | null = null;

function closeWatcher(dir: string): void {
  watchers.get(dir)?.close();
  watchers.delete(dir);
}

// Directories appear when a store gets installed and vanish with an unmounted SD card, so watchers follow each check
function syncWatchers(): void {
  const dirs = new Set(getStoreWatchDirs());

  for (const dir of watchers.keys()) {
    if (!dirs.has(dir)) {
      closeWatcher(dir);
    }
  }

  for (const dir of dirs) {
    if (watchers.has(dir)) {
      continue;
    }
    try {
      const watcher = fs.watch(dir, () => watchCheck.schedule());
      watcher.on('error', (error) => {
        console.warn(`[StoreWatcher] Watcher for ${dir} failed:`, error);
        closeWatcher(dir);
      });
      watchers.set(dir, watcher);
    } catch (error) {
      console.warn(`[StoreWatcher] Cannot watch ${dir}:`, error);
    }
  }
}

function checkStores(force: boolean): boolean {
  let changed: string[] = [];
  try {
    changed = revalidateStores(force);
    syncWatchers();
  } catch (error) {
    console.error('[StoreWatcher] Store check failed:', error);
  }

  if (changed.length > 0) {
    console.log(`[StoreWatcher] Store libraries changed: ${changed.join(', ')}`);
    getMainWindow()?.webContents.send('store-library-changed');
  }
  return changed.length > 0;
}

const watchCheck = F.makeControlledDebounce(
  () => {
    checkStores(false);
  },
  { delay: WATCH_DEBOUNCE, leading: false }
);

/** Opening the filters: re-probes every store; a change also reaches the renderer as store-library-changed. */
export function checkStoreLibraries(): boolean {
  return checkStores(true);
}

// Returning to the launcher after installing something in another store is the common case
const focusCheck = F.makeControlledThrottle(
  () => {
    // Async and non-blocking; a new root comes back through onXboxRootsChanged
    void refreshXboxRoots();
    checkStores(true);
  },
  // ts-belt runs the first call at once and then holds the window only with leading: false
  { delay: FOCUS_THROTTLE, leading: false }
);

function handleWindowFocus(): void {
  if (!startupTimer) {
    focusCheck.schedule();
  }
}

function handleResume(): void {
  // Network drives that timed out before sleep may be back
  void refreshXboxRoots({ retryDeadDrives: true });
  checkStores(true);
}

export function startStoreLibraryWatcher(): void {
  // The first scan starts right away in the background, so Xbox games show up without waiting for a focus
  unsubscribeXboxRoots = onXboxRootsChanged(() => {
    checkStores(false);
  });
  void refreshXboxRoots();
  startupTimer = setTimeout(() => {
    startupTimer = null;
    checkStores(false);
  }, STARTUP_DELAY);
  app.on('browser-window-focus', handleWindowFocus);
  powerMonitor.on('resume', handleResume);
}

export function stopStoreLibraryWatcher(): void {
  app.off('browser-window-focus', handleWindowFocus);
  powerMonitor.off('resume', handleResume);
  unsubscribeXboxRoots?.();
  unsubscribeXboxRoots = null;
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  watchCheck.cancel();
  for (const dir of [...watchers.keys()]) {
    closeWatcher(dir);
  }
}
