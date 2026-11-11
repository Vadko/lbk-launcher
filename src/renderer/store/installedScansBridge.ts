import { isCatalogReady } from './isCatalogReady';
import { useStore } from './useStore';
import { useWorkshopInstallsStore } from './useWorkshopInstallsStore';

const IDLE_TIMEOUT_MS = 2000;

function scanInstalled(): void {
  void useStore.getState().loadInstalledGamesFromSystem();
  void useWorkshopInstallsStore.getState().reconcileAll();
  void useStore.getState().detectInstalledGames();
}

// Pre-sync catalog rows have stale versions and may be missing entirely, so each scan waits for a finished sync
export function initInstalledScans(): void {
  if (!window.electronAPI) {
    return;
  }
  let idleId = 0;
  useStore.subscribe((state, prev) => {
    if (state.syncStatus === prev.syncStatus) {
      return;
    }
    cancelIdleCallback(idleId);
    if (isCatalogReady()) {
      idleId = requestIdleCallback(scanInstalled, { timeout: IDLE_TIMEOUT_MS });
    }
  });
  // detectInstalledGames replaces the map on success and keeps the last detection on error
  window.electronAPI.onSteamLibraryChanged?.(() => {
    console.log('[Store] Steam library changed, re-detecting installed games');
    void useStore.getState().detectInstalledGames();
  });
}
