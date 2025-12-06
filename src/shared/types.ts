import type { Database } from '../lib/database.types';

export type { Database };
export type InstallPath = Database['public']['CompositeTypes']['install_path_entry'];
export type Game = Database['public']['Tables']['games']['Row'];

export interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
  hasBackup?: boolean;
  installedFiles?: string[]; // Relative paths of all installed files
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  timeRemaining: number; // in seconds
}

export interface InstallationStatus {
  message: string;
}

export interface InstallResult {
  success: boolean;
  error?: {
    message: string;
    needsManualSelection?: boolean;
  };
}

export interface GetGamesParams {
  offset?: number;
  limit?: number;
  searchQuery?: string;
  filter?: string;
  showAdultGames?: boolean;
}

export interface GetGamesResult {
  games: Game[];
  total: number;
  hasMore: boolean;
}

export interface DetectedGameInfo {
  platform: Database['public']['Enums']['install_source'];
  path: string;
  exists: boolean;
}

export interface LaunchGameResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  fetchGames: (params?: GetGamesParams) => Promise<GetGamesResult>;
  fetchGamesByIds: (gameIds: string[]) => Promise<Game[]>;
  getAllInstalledGamePaths: () => Promise<string[]>;
  getAllInstalledSteamGames: () => Promise<Record<string, string>>;
  findGamesByInstallPaths: (installPaths: string[], offset?: number, limit?: number) => Promise<GetGamesResult>;
  installTranslation: (game: Game, platform: string, customGamePath?: string, createBackup?: boolean) => Promise<InstallResult>;
  uninstallTranslation: (game: Game) => Promise<InstallResult>;
  abortDownload: () => Promise<{ success: boolean }>;
  checkInstallation: (game: Game) => Promise<InstallationInfo | null>;
  getAllInstalledGameIds: () => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
  selectGameFolder: () => Promise<string | null>;
  onInstallProgress: (callback: (progress: number) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onInstallationStatus: (callback: (status: InstallationStatus) => void) => void;
  // Auto-updater
  checkForUpdates: () => Promise<{ available: boolean; updateInfo?: unknown; message?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => void;
  onUpdateProgress: (callback: (progress: { percent?: number; bytesPerSecond?: number; total?: number; transferred?: number }) => void) => void;
  onUpdateError: (callback: (error: Error) => void) => void;
  // Real-time updates
  subscribeGameUpdates: () => Promise<{ success: boolean }>;
  unsubscribeGameUpdates: () => Promise<{ success: boolean }>;
  onGameUpdated: (callback: (game: Game) => void) => void;
  // Game update notifications
  showGameUpdateNotification?: (gameName: string, version: string, isInitialLoad: boolean) => void;
  // Game detection
  onSteamLibraryChanged?: (callback: () => void) => void;
  onInstalledGamesChanged?: (callback: () => void) => void;
  // Game launcher
  launchGame: (game: Game) => Promise<LaunchGameResult>;
  // Version
  getVersion: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
