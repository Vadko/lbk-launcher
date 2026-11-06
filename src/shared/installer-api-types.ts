import type {
  ConflictingTranslation,
  DownloadProgress,
  Game,
  InstallationInfo,
  InstallationStatus,
  InstallOptions,
  InstallResult,
  PausedDownloadState,
  RunInstallerDecision,
  RunInstallerRequest,
} from './types';

export type SteamArtworkChangeResult =
  | { success: true; visibleAfterSteamStart: boolean }
  | { success: false; error: string };

export interface InstallerAPI {
  installTranslation: (
    game: Game,
    options: InstallOptions,
    customGamePath?: string
  ) => Promise<InstallResult>;
  uninstallTranslation: (game: Game) => Promise<InstallResult>;
  rerunInstaller: (installerPath: string, protonPath?: string) => Promise<InstallResult>;
  /** Main blocks until `respondRunInstaller` answers with the same gameId. */
  onRequestRunInstallerConfirm: (
    callback: (request: RunInstallerRequest) => void
  ) => () => void;
  respondRunInstaller: (gameId: string, decision: RunInstallerDecision) => void;
  abortDownload: (reason?: string) => Promise<{ success: boolean }>;
  pauseDownload: (
    gameId: string
  ) => Promise<{ success: boolean; state?: PausedDownloadState; error?: string }>;
  resumeDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  getPausedDownload: (gameId: string) => Promise<PausedDownloadState | null>;
  cancelPausedDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  checkInstallation: (game: Game) => Promise<InstallationInfo | null>;
  getConflictingTranslation: (game: Game) => Promise<ConflictingTranslation | null>;
  removeComponents: (
    game: Game,
    componentsToRemove: { voice?: boolean; achievements?: boolean }
  ) => Promise<InstallResult>;
  checkPlatformCompatibility: (game: Game) => Promise<string | null>;
  onDownloadProgress: (
    callback: (gameId: string, progress: DownloadProgress) => void
  ) => () => void;
  onInstallationStatus: (
    callback: (gameId: string, status: InstallationStatus) => void
  ) => () => void;
  isSteamArtworkApplied: (appId: number) => Promise<boolean>;
  setSteamArtwork: (game: Game, enabled: boolean) => Promise<SteamArtworkChangeResult>;
}
