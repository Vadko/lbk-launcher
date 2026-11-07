import * as Sentry from '@sentry/electron/renderer';
import { contextBridge, ipcRenderer } from 'electron';

const isE2EMode = process.env['LBK_E2E'] === '1';
Sentry.init({ enabled: !isE2EMode });

import { RESOURCES_CONNECT_CHANNEL, RESOURCES_PORT_CHANNEL } from '../shared/resources';
import type { ElectronAPI } from '../shared/types';
import { gameReviewsAPI } from './game-reviews-api';
import { invoke, listen, send } from './ipc';
import { systemNotificationAPI } from './system-notification-api';

// The port lands in this isolated world; window messages carry it to the page's listener
ipcRenderer.on(RESOURCES_PORT_CHANNEL, (event) => {
  window.postMessage(RESOURCES_PORT_CHANNEL, '*', event.ports);
});

const electronAPI: ElectronAPI = {
  ...gameReviewsAPI,
  connectResources: send(RESOURCES_CONNECT_CHANNEL),
  fetchGames: invoke('fetch-games'),
  fetchSearchMatchIds: invoke('fetch-search-match-ids'),
  checkStoreLibraries: invoke('check-store-libraries'),
  onStoreLibraryChanged: listen('store-library-changed'),
  fetchTrendingGames: invoke('fetch-trending-games'),
  fetchGamesByIds: invoke('fetch-games-by-ids'),
  fetchRecommendedGames: invoke('fetch-recommended-games'),
  syncKurinGames: invoke('sync-kurin-games'),
  getAllInstalledGamePaths: invoke('get-all-installed-game-paths'),
  getDetectedGames: invoke('get-detected-games'),
  getAvailableProtons: invoke('get-available-protons'),
  findGamesByInstallPaths: invoke('find-games-by-install-paths'),
  getSteamLibraryAppIds: invoke('get-steam-library-app-ids'),
  findGamesBySteamAppIds: invoke('find-games-by-steam-app-ids'),
  findGamesByTitles: invoke('find-games-by-titles'),
  getGogLibrary: invoke('get-gog-library'),
  getEpicLibrary: invoke('get-epic-library'),
  getXboxInstalledPaths: invoke('get-xbox-installed-paths'),
  findGamesByXboxPaths: invoke('find-games-by-xbox-paths'),
  detectGamePlatforms: invoke('detect-game-platforms'),
  setGameVisibility: (gameId, hidden) =>
    ipcRenderer.invoke('set-game-visibility', { gameId, hidden }),
  installTranslation: invoke('install-translation'),
  uninstallTranslation: invoke('uninstall-translation'),
  rerunInstaller: invoke('rerun-installer'),
  showItemInFolder: invoke('show-item-in-folder'),
  onRequestRunInstallerConfirm: listen('installer:confirm-run'),
  respondRunInstaller: send('installer:run-decision'),
  abortDownload: invoke('abort-download'),
  pauseDownload: invoke('pause-download'),
  resumeDownload: invoke('resume-download'),
  getPausedDownload: invoke('get-paused-download'),
  cancelPausedDownload: invoke('cancel-paused-download'),
  checkInstallation: invoke('check-installation'),
  getConflictingTranslation: invoke('get-conflicting-translation'),
  getAllInstalledGameIds: invoke('get-all-installed-game-ids'),
  removeOrphanedMetadata: invoke('remove-orphaned-metadata'),
  removeComponents: invoke('remove-components'),
  isSteamArtworkApplied: invoke('is-steam-artwork-applied'),
  setSteamArtwork: invoke('set-steam-artwork'),
  checkPlatformCompatibility: invoke('check-platform-compatibility'),
  fetchNewsFeed: invoke('fetch-news-feed'),
  openExternal: invoke('open-external'),
  selectGameFolder: invoke('select-game-folder'),
  onDownloadProgress: listen('download-progress'),
  onInstallationStatus: listen('installation-status'),
  checkForUpdates: invoke('check-for-updates'),
  downloadUpdate: invoke('download-update'),
  installUpdate: invoke('install-update'),
  onUpdateAvailable: listen('update-available'),
  onUpdateDownloaded: listen('update-downloaded'),
  onUpdateProgress: listen('update-progress'),
  onUpdateError: listen('update-error'),
  fetchChangelog: invoke('fetch-changelog'),
  onGameUpdated: listen('game-updated'),
  onGameCountersUpdated: listen('game-counters-updated'),
  onGameRemoved: listen('game-removed'),
  isGameTombstoned: invoke('is-game-tombstoned'),
  onGameTombstoned: listen('game-tombstoned'),
  onSteamLibraryChanged: listen('steam-library-changed'),
  onTestGamesChanged: listen('test-games-changed'),
  onInstalledGamesChanged: listen('installed-games-changed'),
  launchGame: invoke('launch-game'),
  openAppLink: invoke('open-app-link'),
  restartSteam: invoke('restart-steam'),
  applyPendingLaunchOptions: invoke('apply-pending-launch-options'),
  getSteamBridgeStatus: invoke('get-steam-bridge-status'),
  recheckSteamBridge: invoke('recheck-steam-bridge'),
  getPluginHostState: invoke('plugin-host:get-state'),
  prepareMillennium: invoke('millennium:prepare'),
  activateMillennium: invoke('millennium:activate'),
  uninstallMillennium: invoke('millennium:uninstall'),
  cancelMillennium: invoke('millennium:cancel'),
  requestDeckyPluginInstall: invoke('decky:request-plugin-install'),
  installDeckyLoader: invoke('decky:install-loader'),
  saveDeckyPluginZip: invoke('decky:save-plugin-zip'),
  onMillenniumProgress: listen('millennium:progress'),
  onSteamRestartRequired: listen('steam-restart-required'),
  setSteamCefDebugging: invoke('set-steam-cef-debugging'),
  syncSteamTranslatedCollection: invoke('sync-steam-translated-collection'),
  addLbkLauncherToSteamLibrary: invoke('add-lbk-launcher-to-steam-library'),
  getVersion: () => ipcRenderer.sendSync('get-version'),
  isE2E: () => isE2EMode,
  getPlatform: () => ipcRenderer.sendSync('get-platform'),
  getSystemInfo: () => ipcRenderer.sendSync('get-system-info'),
  getMachineId: invoke('get-machine-id'),
  trackSubscription: invoke('track-subscription'),
  trackSupportClick: invoke('track-support-click'),
  setLike: invoke('likes:set'),
  setWorkshopSubscription: invoke('set-workshop-subscription'),
  listInstalledWorkshopGames: invoke('list-installed-workshop-games'),
  isWorkshopItemDownloaded: invoke('is-workshop-item-downloaded'),
  // Navigating to the Workshop counts as a download
  trackWorkshopOpen: invoke('track-workshop-open'),
  trackFailedSearch: invoke('track-failed-search'),
  submitLogs: invoke('submit-logs'),
  onDeepLink: listen('deep-link'),
  findDeepLinkGameId: invoke('find-deep-link-game-id'),
  notifyReady: send('renderer-ready'),
  onSyncStatus: listen('sync-status'),
  getSyncStatus: invoke('get-sync-status'),
  fetchPromoBanner: invoke('fetch-promo-banner'),
  fetchBannersForGame: invoke('fetch-banners-for-game'),
  recordPromoBannerImpression: invoke('record-promo-banner-impression'),
  recordBannerImpression: invoke('record-banner-impression'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

const windowControls: WindowControlsAPI = {
  minimize: send('window:minimize'),
  maximize: send('window:maximize'),
  close: send('window:close'),
  onMaximizedChange: listen('window:maximized'),
  isVisible: invoke('window:is-visible'),
  ...systemNotificationAPI,
};
contextBridge.exposeInMainWorld('windowControls', windowControls);

const liquidGlassAPI: LiquidGlassAPI = {
  isSupported: invoke('liquid-glass:is-supported'),
  toggle: invoke('liquid-glass:toggle'),
};
contextBridge.exposeInMainWorld('liquidGlassAPI', liquidGlassAPI);

const loggerAPI: LoggerAPI = {
  openLogsFolder: invoke('logger:open-logs-folder'),
  log: (level, message, ...args) => ipcRenderer.send('logger:log', level, message, args),
};
contextBridge.exposeInMainWorld('loggerAPI', loggerAPI);

const api: API = {
  logError: (message, stack) => ipcRenderer.send('logger:log', 'error', message, [stack]),
  clearCacheOnly: invoke('clear-cache-only'),
  clearAllData: invoke('clear-all-data-and-restart'),
};
contextBridge.exposeInMainWorld('api', api);

// getItem is sync so a persisted store rehydrates before its first render
const storeStorage: StoreStorageAPI = {
  getItem: (key) => ipcRenderer.sendSync('store-storage:get', key),
  setItem: (key, value) => {
    ipcRenderer.invoke('store-storage:set', key, value);
  },
  removeItem: (key) => {
    ipcRenderer.invoke('store-storage:remove', key);
  },
};
contextBridge.exposeInMainWorld('storeStorage', storeStorage);
