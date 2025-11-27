export interface Game {
  id: string;
  slug: string;
  name: string;
  version: string;
  translation_progress: number;
  editing_progress: number;
  team: string;
  status: 'completed' | 'in-progress' | 'planned';
  platforms: string[];
  install_paths: {
    steam?: string;
    gog?: string;
  };
  archive_path: string;
  banner_path: string | null;
  logo_path: string | null;
  thumbnail_path: string | null;
  game_description: string | null;
  description: string | null;
  support_url: string | null;
  video_url: string | null;
}

export interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
}

export interface ElectronAPI {
  fetchGames: () => Promise<Game[]>;
  installTranslation: (gameId: string, platform: string, customGamePath?: string) => Promise<void>;
  checkInstallation: (gameId: string) => Promise<InstallationInfo | null>;
  openExternal: (url: string) => Promise<void>;
  selectGameFolder: () => Promise<string | null>;
  onInstallProgress: (callback: (progress: number) => void) => void;
  // Auto-updater
  checkForUpdates: () => Promise<{ available: boolean; updateInfo?: any; message?: string; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateProgress: (callback: (progress: any) => void) => void;
  onUpdateError: (callback: (error: any) => void) => void;
  // Real-time updates
  subscribeGameUpdates: () => Promise<{ success: boolean }>;
  unsubscribeGameUpdates: () => Promise<{ success: boolean }>;
  onGameUpdated: (callback: (game: Game) => void) => void;
  // Version
  getVersion: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
