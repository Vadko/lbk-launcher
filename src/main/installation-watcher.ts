import * as fs from 'fs';
import * as path from 'path';
import { app, type BrowserWindow } from 'electron';
import { invalidateInstalledGameIdsCache } from './installer';

let watcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
const pendingChanges = new Set<string>();

/**
 * Start watching installation-cache directory for changes
 */
export function startInstallationWatcher(mainWindow: BrowserWindow | null): void {
  // Close any existing watcher first to prevent EMFILE errors
  if (watcher) {
    console.log('[InstallationWatcher] Closing existing watcher before starting new one');
    watcher.close();
    watcher = null;
  }

  const userDataPath = app.getPath('userData');
  const installInfoDir = path.join(userDataPath, 'installation-cache');

  // Create directory if it doesn't exist
  if (!fs.existsSync(installInfoDir)) {
    fs.mkdirSync(installInfoDir, { recursive: true });
  }

  console.log('[InstallationWatcher] Starting directory watcher for:', installInfoDir);

  // Watch for directory changes (file additions/deletions)
  watcher = fs.watch(installInfoDir, (_eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      // Collect pending changes and debounce
      pendingChanges.add(filename);

      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce: wait 100ms before processing to batch multiple rapid changes
      debounceTimer = setTimeout(() => {
        if (pendingChanges.size > 0) {
          console.log(
            '[InstallationWatcher] Installation cache changed:',
            [...pendingChanges].join(', ')
          );
          pendingChanges.clear();

          // Invalidate the installed game IDs cache
          invalidateInstalledGameIdsCache();

          // Notify renderer to refresh installed games list
          mainWindow?.webContents.send('installed-games-changed');
        }
      }, 100);
    }
  });
}

/**
 * Stop watching installation-cache directory
 */
export function stopInstallationWatcher(): void {
  if (watcher) {
    console.log('[InstallationWatcher] Stopping directory watcher');
    watcher.close();
    watcher = null;
  }
}
