import type { Database } from '../lib/database.types';

export type { Database };
export type InstallPath = Database['public']['CompositeTypes']['install_path_entry'];
export type Game = Database['public']['Tables']['games']['Row'];

interface InstallationComponent {
  installed: boolean;
  files: string[]; // Relative paths of installed files for this component
}

export interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
  hasBackup?: boolean;
  isCustomPath?: boolean; // True if installed via manual folder selection (not auto-detected Steam path)
  installedFiles?: string[]; // Legacy: Relative paths of all installed files (kept for migration)
  components?: {
    text: InstallationComponent;
    voice?: InstallationComponent;
    achievements?: InstallationComponent;
  };
}

export interface ConflictingTranslation {
  gameId: string;
  gameName: string;
  team: string | null;
  version: string;
  gamePath: string;
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
  progress?: number;
}

export interface InstallResult {
  success: boolean;
  paused?: boolean;
  error?: {
    message: string;
    needsManualSelection?: boolean;
    isRateLimit?: boolean;
  };
}

export interface InstallOptions {
  createBackup: boolean;
  installText: boolean;
  installVoice: boolean;
  installAchievements: boolean;
}

export interface PausedDownloadState {
  gameId: string;
  url: string;
  outputPath: string;
  downloadedBytes: number;
  totalBytes: number;
  pausedAt: string;
  options: InstallOptions;
  platform: string;
  customGamePath?: string;
}

export interface GetGamesParams {
  searchQuery?: string;
  statuses?: string[];
  authors?: string[];
  showAdultGames?: boolean;
  showAiTranslations?: boolean;
  sortOrder?: 'name' | 'downloads';
}

export interface GetGamesResult {
  games: Game[];
  total: number;
}

export interface FilterCountsResult {
  planned: number;
  'in-progress': number;
  completed: number;
  'with-achievements': number;
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
  fetchTeams: () => Promise<string[]>;
  fetchFilterCounts: () => Promise<FilterCountsResult>;
  fetchGamesByIds: (gameIds: string[], searchQuery?: string, showAiTranslations?: boolean) => Promise<Game[]>;
  getAllInstalledGamePaths: () => Promise<string[]>;
  getAllInstalledSteamGames: () => Promise<Record<string, string>>;
  findGamesByInstallPaths: (
    installPaths: string[],
    searchQuery?: string,
    showAiTranslations?: boolean
  ) => Promise<GetGamesResult>;
  installTranslation: (
    game: Game,
    platform: string,
    options: InstallOptions,
    customGamePath?: string
  ) => Promise<InstallResult>;
  uninstallTranslation: (game: Game) => Promise<InstallResult>;
  abortDownload: (reason?: string) => Promise<{ success: boolean }>;
  pauseDownload: (
    gameId: string
  ) => Promise<{ success: boolean; state?: PausedDownloadState; error?: string }>;
  resumeDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  getPausedDownload: (gameId: string) => Promise<PausedDownloadState | null>;
  cancelPausedDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  checkInstallation: (game: Game) => Promise<InstallationInfo | null>;
  getConflictingTranslation: (game: Game) => Promise<ConflictingTranslation | null>;
  getAllInstalledGameIds: () => Promise<string[]>;
  removeOrphanedMetadata: (gameIds: string[]) => Promise<{ success: boolean }>;
  removeComponents: (
    game: Game,
    componentsToRemove: { voice?: boolean; achievements?: boolean }
  ) => Promise<InstallResult>;
  checkPlatformCompatibility: (game: Game) => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  selectGameFolder: () => Promise<string | null>;
  onInstallProgress: (callback: (progress: number) => void) => () => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
  onInstallationStatus: (callback: (status: InstallationStatus) => void) => () => void;
  // Auto-updater
  checkForUpdates: () => Promise<{
    available: boolean;
    updateInfo?: unknown;
    message?: string;
    error?: string;
  }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  onUpdateProgress: (
    callback: (progress: {
      percent?: number;
      bytesPerSecond?: number;
      total?: number;
      transferred?: number;
    }) => void
  ) => () => void;
  onUpdateError: (callback: (error: Error) => void) => () => void;
  // Real-time updates (автоматично керуються в main process)
  onGameUpdated: (callback: (game: Game) => void) => () => void;
  onGameRemoved: (callback: (gameId: string) => void) => () => void;
  // Game detection
  onSteamLibraryChanged?: (callback: () => void) => () => void;
  onInstalledGamesChanged?: (callback: () => void) => () => void;
  // Game launcher
  launchGame: (game: Game) => Promise<LaunchGameResult>;
  // Steam integration
  restartSteam: () => Promise<{ success: boolean; error?: string }>;
  // Version
  getVersion: () => string;
  // Machine ID - for subscription tracking
  getMachineId: () => Promise<string | null>;
  // Track subscription events
  trackSubscription: (
    gameId: string,
    action: 'subscribe' | 'unsubscribe'
  ) => Promise<{ success: boolean; error?: string }>;
  // Deep link handling
  onDeepLink: (callback: (data: { slug: string; team: string }) => void) => () => void;
  // Sync status
  onSyncStatus: (callback: (status: 'syncing' | 'ready' | 'error') => void) => () => void;
  getSyncStatus: () => Promise<'syncing' | 'ready' | 'error'>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
