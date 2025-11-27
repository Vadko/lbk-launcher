import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../shared/types';

const electronAPI: ElectronAPI = {
  fetchGames: () => ipcRenderer.invoke('fetch-games'),
  installTranslation: (gameId: string, platform: string, customGamePath?: string) =>
    ipcRenderer.invoke('install-translation', gameId, platform, customGamePath),
  checkInstallation: (gameId: string) => ipcRenderer.invoke('check-installation', gameId),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
  onInstallProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('install-progress', (_, progress) => callback(progress));
  },
  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-progress', (_, progress) => callback(progress));
  },
  onUpdateError: (callback: (error: any) => void) => {
    ipcRenderer.on('update-error', (_, error) => callback(error));
  },
  // Real-time updates
  subscribeGameUpdates: () => ipcRenderer.invoke('subscribe-game-updates'),
  unsubscribeGameUpdates: () => ipcRenderer.invoke('unsubscribe-game-updates'),
  onGameUpdated: (callback: (game: any) => void) => {
    ipcRenderer.on('game-updated', (_, game) => callback(game));
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
