import { F } from '@mobily/ts-belt';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { invalidateInstalledGameIdsCache } from './installer/cache';
import { sendToRenderer } from './window';

let watcher: fs.FSWatcher | null = null;
const pendingChanges = new Set<string>();

// Batches the rapid writes of one install into a single refresh
const flushChanges = F.makeControlledDebounce(
  (onChange?: () => void) => {
    if (pendingChanges.size === 0) {
      return;
    }
    console.log(
      '[InstallationWatcher] Installation cache changed:',
      [...pendingChanges].join(', ')
    );
    pendingChanges.clear();

    // Invalidate the installed game IDs cache
    invalidateInstalledGameIdsCache();

    // Notify renderer to refresh installed games list
    sendToRenderer('installed-games-changed');

    // Optional callback (e.g. process server-side tombstoned games
    // that became uninstalled and can now be removed locally)
    onChange?.();
  },
  { delay: 100, leading: false }
);

/**
 * Start watching installation-cache directory for changes
 */
export function startInstallationWatcher(onChange?: () => void): void {
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
      pendingChanges.add(filename);
      flushChanges.schedule(onChange);
    }
  });
}

/**
 * Stop watching installation-cache directory
 */
export function stopInstallationWatcher(): void {
  flushChanges.cancel();
  if (watcher) {
    console.log('[InstallationWatcher] Stopping directory watcher');
    watcher.close();
    watcher = null;
  }
}
