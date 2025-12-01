import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../shared/types';

const electronAPI: ElectronAPI = {
  fetchGames: () => ipcRenderer.invoke('fetch-games'),
  installTranslation: (gameId: string, platform: string, customGamePath?: string, createBackup?: boolean) =>
    ipcRenderer.invoke('install-translation', gameId, platform, customGamePath, createBackup),
  uninstallTranslation: (gameId: string) => ipcRenderer.invoke('uninstall-translation', gameId),
  checkInstallation: (gameId: string) => ipcRenderer.invoke('check-installation', gameId),
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
  // Version
  getVersion: () => ipcRenderer.sendSync('get-version'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Window controls
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});

// Listen for game update notifications and dispatch as custom events
ipcRenderer.on('game-update-available', (_, updateInfo) => {
  window.dispatchEvent(new CustomEvent('game-update-available', { detail: updateInfo }));
});
