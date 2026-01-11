import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, Game, InstallOptions } from '../shared/types';

const electronAPI: ElectronAPI = {
  fetchGames: (params) => ipcRenderer.invoke('fetch-games', params),
  fetchTeams: () => ipcRenderer.invoke('fetch-teams'),
  fetchFilterCounts: () => ipcRenderer.invoke('fetch-filter-counts'),
  fetchGamesByIds: (gameIds: string[], searchQuery?: string, showAiTranslations?: boolean) =>
    ipcRenderer.invoke('fetch-games-by-ids', gameIds, searchQuery, showAiTranslations),
  getAllInstalledGamePaths: () => ipcRenderer.invoke('get-all-installed-game-paths'),
  getAllInstalledSteamGames: () => ipcRenderer.invoke('get-all-installed-steam-games'),
  findGamesByInstallPaths: (installPaths: string[], searchQuery?: string, showAiTranslations?: boolean) =>
    ipcRenderer.invoke('find-games-by-install-paths', installPaths, searchQuery, showAiTranslations),
  installTranslation: (
    game: Game,
    platform: string,
    options: InstallOptions,
    customGamePath?: string
  ) => ipcRenderer.invoke('install-translation', game, platform, options, customGamePath),
  uninstallTranslation: (game: Game) => ipcRenderer.invoke('uninstall-translation', game),
  abortDownload: (reason?: string) => ipcRenderer.invoke('abort-download', reason),
  pauseDownload: (gameId: string) => ipcRenderer.invoke('pause-download', gameId),
  resumeDownload: (gameId: string) => ipcRenderer.invoke('resume-download', gameId),
  getPausedDownload: (gameId: string) =>
    ipcRenderer.invoke('get-paused-download', gameId),
  cancelPausedDownload: (gameId: string) =>
    ipcRenderer.invoke('cancel-paused-download', gameId),
  checkInstallation: (game: Game) => ipcRenderer.invoke('check-installation', game),
  getConflictingTranslation: (game: Game) =>
    ipcRenderer.invoke('get-conflicting-translation', game),
  getAllInstalledGameIds: () => ipcRenderer.invoke('get-all-installed-game-ids'),
  removeOrphanedMetadata: (gameIds: string[]) =>
    ipcRenderer.invoke('remove-orphaned-metadata', gameIds),
  removeComponents: (
    game: Game,
    componentsToRemove: { voice?: boolean; achievements?: boolean }
  ) => ipcRenderer.invoke('remove-components', game, componentsToRemove),
  checkPlatformCompatibility: (game: Game) =>
    ipcRenderer.invoke('check-platform-compatibility', game),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  onInstallProgress: (callback: (progress: number) => void) => {
    const handler = (_: unknown, progress: number) => callback(progress);
    ipcRenderer.on('install-progress', handler);
    return () => ipcRenderer.removeListener('install-progress', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_: unknown, progress: Parameters<typeof callback>[0]) =>
      callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onInstallationStatus: (callback) => {
    const handler = (_: unknown, status: Parameters<typeof callback>[0]) =>
      callback(status);
    ipcRenderer.on('installation-status', handler);
    return () => ipcRenderer.removeListener('installation-status', handler);
  },
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    const handler = (_: unknown, info: Parameters<typeof callback>[0]) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_: unknown, info: Parameters<typeof callback>[0]) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_: unknown, progress: Parameters<typeof callback>[0]) =>
      callback(progress);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_: unknown, error: Parameters<typeof callback>[0]) =>
      callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  // Real-time updates (автоматично керуються в main process)
  onGameUpdated: (callback) => {
    const handler = (_: unknown, game: Parameters<typeof callback>[0]) => callback(game);
    ipcRenderer.on('game-updated', handler);
    return () => ipcRenderer.removeListener('game-updated', handler);
  },
  onGameRemoved: (callback: (gameId: string) => void) => {
    const handler = (_: unknown, gameId: string) => callback(gameId);
    ipcRenderer.on('game-removed', handler);
    return () => ipcRenderer.removeListener('game-removed', handler);
  },
  // Game detection
  onSteamLibraryChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('steam-library-changed', handler);
    return () => ipcRenderer.removeListener('steam-library-changed', handler);
  },
  onInstalledGamesChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('installed-games-changed', handler);
    return () => ipcRenderer.removeListener('installed-games-changed', handler);
  },
  // Game launcher
  launchGame: (game: Game) => ipcRenderer.invoke('launch-game', game),
  // Steam integration
  restartSteam: () => ipcRenderer.invoke('restart-steam'),
  // Version
  getVersion: () => ipcRenderer.sendSync('get-version'),
  // Machine ID - for subscription tracking
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  // Track subscription events
  trackSubscription: (gameId: string, action: 'subscribe' | 'unsubscribe') =>
    ipcRenderer.invoke('track-subscription', gameId, action),
  // Deep link handling
  onDeepLink: (callback: (data: { slug: string; team: string }) => void) => {
    const handler = (_: unknown, data: { slug: string; team: string }) => callback(data);
    ipcRenderer.on('deep-link', handler);
    return () => ipcRenderer.removeListener('deep-link', handler);
  },
  // Sync status
  onSyncStatus: (callback: (status: 'syncing' | 'ready' | 'error') => void) => {
    const handler = (_: unknown, status: 'syncing' | 'ready' | 'error') =>
      callback(status);
    ipcRenderer.on('sync-status', handler);
    return () => ipcRenderer.removeListener('sync-status', handler);
  },
  getSyncStatus: () =>
    ipcRenderer.invoke('get-sync-status') as Promise<'syncing' | 'ready' | 'error'>,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Window controls
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_: unknown, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
  isVisible: () => ipcRenderer.invoke('window:is-visible'),
  showSystemNotification: (options: { title: string; body: string; gameId?: string }) =>
    ipcRenderer.invoke('show-system-notification', options),
  onNavigateToGame: (callback: (gameId: string) => void) => {
    const handler = (_: unknown, gameId: string) => callback(gameId);
    ipcRenderer.on('navigate-to-game', handler);
    return () => ipcRenderer.removeListener('navigate-to-game', handler);
  },
  clearCacheAndRestart: () => ipcRenderer.invoke('clear-cache-and-restart'),
});

// Liquid Glass API
contextBridge.exposeInMainWorld('liquidGlassAPI', {
  isSupported: () => ipcRenderer.invoke('liquid-glass:is-supported'),
  toggle: (enabled: boolean) => ipcRenderer.invoke('liquid-glass:toggle', enabled),
});

// Logger API
contextBridge.exposeInMainWorld('loggerAPI', {
  setEnabled: (enabled: boolean) => ipcRenderer.invoke('logger:set-enabled', enabled),
  isEnabled: () => ipcRenderer.invoke('logger:is-enabled'),
  openLogsFolder: () => ipcRenderer.invoke('logger:open-logs-folder'),
  log: (level: string, message: string, ...args: unknown[]) =>
    ipcRenderer.send('logger:log', level, message, args),
});

// Error handling API
contextBridge.exposeInMainWorld('api', {
  logError: (message: string, stack: string) =>
    ipcRenderer.send('logger:log', 'error', message, [stack]),
  clearCacheOnly: () => ipcRenderer.invoke('clear-cache-only'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data-and-restart'),
  // Legacy - kept for backwards compatibility
  clearCache: () => ipcRenderer.invoke('clear-all-data-and-restart'),
});

// Handle liquid glass preference request from main process
ipcRenderer.on('liquid-glass:get-preference', () => {
  // Get the preference from localStorage (settings store)
  const settings = localStorage.getItem('lbk-settings');
  let enabled = true; // Default to true

  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      enabled = parsed.state?.liquidGlassEnabled ?? true;
    } catch {
      // Ignore parse errors
    }
  }

  ipcRenderer.send('liquid-glass:get-preference-response', enabled);
});
