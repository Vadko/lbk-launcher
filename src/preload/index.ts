import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, Game } from '../shared/types';

const electronAPI: ElectronAPI = {
  fetchGames: (params) => ipcRenderer.invoke('fetch-games', params),
  fetchGamesByIds: (gameIds: string[]) => ipcRenderer.invoke('fetch-games-by-ids', gameIds),
  getAllInstalledGamePaths: () => ipcRenderer.invoke('get-all-installed-game-paths'),
  getAllInstalledSteamGames: () => ipcRenderer.invoke('get-all-installed-steam-games'),
  findGamesByInstallPaths: (installPaths: string[], offset?: number, limit?: number) =>
    ipcRenderer.invoke('find-games-by-install-paths', installPaths, offset, limit),
  installTranslation: (game: Game, platform: string, customGamePath?: string, createBackup?: boolean) =>
    ipcRenderer.invoke('install-translation', game, platform, customGamePath, createBackup),
  uninstallTranslation: (game: Game) => ipcRenderer.invoke('uninstall-translation', game),
  abortDownload: () => ipcRenderer.invoke('abort-download'),
  checkInstallation: (game: Game) => ipcRenderer.invoke('check-installation', game),
  getAllInstalledGameIds: () => ipcRenderer.invoke('get-all-installed-game-ids'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  onInstallProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('install-progress', (_, progress) => callback(progress));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
  },
  onInstallationStatus: (callback) => {
    ipcRenderer.on('installation-status', (_, status) => callback(status));
  },
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (_, progress) => callback(progress));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },
  // Real-time updates
  subscribeGameUpdates: () => ipcRenderer.invoke('subscribe-game-updates'),
  unsubscribeGameUpdates: () => ipcRenderer.invoke('unsubscribe-game-updates'),
  onGameUpdated: (callback) => {
    ipcRenderer.on('game-updated', (_, game) => callback(game));
  },
  // Game update notifications
  showGameUpdateNotification: (gameName: string, version: string, isInitialLoad: boolean) => {
    ipcRenderer.send('show-game-update-notification', gameName, version, isInitialLoad);
  },
  // Game detection
  onSteamLibraryChanged: (callback: () => void) => {
    ipcRenderer.on('steam-library-changed', callback);
  },
  onInstalledGamesChanged: (callback: () => void) => {
    ipcRenderer.on('installed-games-changed', callback);
  },
  // Game launcher
  launchGame: (game: Game) => ipcRenderer.invoke('launch-game', game),
  // Version
  getVersion: () => ipcRenderer.sendSync('get-version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Window controls
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_, isMaximized) => callback(isMaximized));
  },
});

// Listen for game update notifications and dispatch as custom events
ipcRenderer.on('game-update-available', (_, updateInfo) => {
  window.dispatchEvent(new CustomEvent('game-update-available', { detail: updateInfo }));
});
