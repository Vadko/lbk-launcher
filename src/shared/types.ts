import type { Database } from '../lib/database.types';

type GameStatus = Database['public']['Enums']['game_status'];

export type InstallPath = Database['public']['CompositeTypes']['install_path_entry'];

export interface Game {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  translation_progress: number;
  editing_progress: number;
  team: string;
  status: GameStatus;
  platforms: string[];
  install_paths: InstallPath[];
  archive_path: string | null;
  banner_path: string | null;
  logo_path: string | null;
  thumbnail_path: string | null;
  game_description: string | null;
  description: string | null;
  support_url: string | null;
  video_url: string | null;
  installation_file_windows_path: string | null;
  installation_file_linux_path: string | null;
}

export interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
}

export interface InstallResult {
  success: boolean;
  error?: {
    message: string;
    needsManualSelection?: boolean;
  };
}

export interface ElectronAPI {
  fetchGames: () => Promise<Game[]>;
  installTranslation: (gameId: string, platform: string, customGamePath?: string) => Promise<InstallResult>;
  checkInstallation: (gameId: string) => Promise<InstallationInfo | null>;
  openExternal: (url: string) => Promise<void>;
  selectGameFolder: () => Promise<string | null>;
  onInstallProgress: (callback: (progress: number) => void) => void;
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
  // Version
  getVersion: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
