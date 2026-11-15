import { type AppUpdateInfo, useAppUpdateStore } from './useAppUpdateStore';
import { useChangelogStore } from './useChangelogStore';
import { useSettingsStore } from './useSettingsStore';
import { APP_UPDATE_GAME_ID, useSubscriptionsStore } from './useSubscriptionsStore';

async function notifyVersion(version: string): Promise<void> {
  const store = useAppUpdateStore.getState();
  if (store.notifiedVersion === version) {
    return;
  }
  store.setNotifiedVersion(version);
  const currentVersion = await window.electronAPI.getVersion();
  const { addAppUpdateNotification, hasNotifiedVersion } =
    useSubscriptionsStore.getState();
  if (!hasNotifiedVersion(APP_UPDATE_GAME_ID, version)) {
    addAppUpdateNotification(currentVersion, version);
  }
}

function handleAvailable(update: AppUpdateInfo): void {
  const version = update?.version;
  if (version) {
    void useChangelogStore.getState().loadForVersion(version);
  }
  if (!useSettingsStore.getState().appUpdateNotificationsEnabled) {
    return;
  }
  useAppUpdateStore.getState().showAvailable(update);
  if (version) {
    void notifyVersion(version);
  }
}

// Main announces an update once, so its state lives outside the tree a language switch remounts.
export function initAppUpdates(): void {
  if (!window.electronAPI) {
    return;
  }
  window.electronAPI.onUpdateAvailable((info) => {
    console.log('[Store] Update available:', info);
    handleAvailable(info as AppUpdateInfo);
  });
  window.electronAPI.onUpdateDownloaded((info) => {
    console.log('[Store] Update downloaded:', info);
    useAppUpdateStore.getState().setDownloaded();
  });
  window.electronAPI.onUpdateProgress((progress) => {
    useAppUpdateStore.getState().setProgress(progress.percent || 0);
  });
  window.electronAPI.onUpdateError((error) => {
    console.error('[Store] Update error:', error);
    useAppUpdateStore.getState().failDownload();
  });
}
