import type {
  BannerData,
  GameBannersResult,
  ImpressionType,
} from '@/main/db/banners-api';
import type { Database } from '../lib/database.types';

export type { Database };

export type Platform = Database['public']['Enums']['install_source'];
export type BannerType = Database['public']['Enums']['banner_type'];
export type FeedbackType = Database['public']['Enums']['feedback_type'];
export type InstallPath = Database['public']['CompositeTypes']['install_path_entry'];
export type Game = Database['public']['Tables']['games']['Row'];
export type SortOrderType = 'name' | 'downloads' | 'newest' | 'updated' | 'subscribers';

export interface NewsFeedItem {
  id: string;
  url: string;
  title?: string;
  content?: string;
  publishedAt?: string;
}

export type NewsFeedFilter = 'games-80' | 'news' | 'sales';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export interface GamePath {
  platform: Platform;
  path: string;
  exists: boolean;
}

interface InstallationComponent {
  installed: boolean;
  files: string[]; // Relative paths of installed files for this component
  /**
   * Source archive hash that produced these files. Used to detect whether a
   * subsequent update actually changes the component — if the hash matches,
   * the bytes on disk are identical and we can skip both the re-install and
   * any "restart Steam" prompts tied to this component.
   */
  archiveHash?: string;
}

export interface InstallationInfo {
  gameId: string;
  version: string;
  installedAt: string;
  gamePath: string;
  hasBackup?: boolean;
  hasInstallError?: boolean; // True if installation was attempted but failed
  protonPath?: string; // For Linux Proton installations
  isCustomPath?: boolean; // True if installed via manual folder selection (not auto-detected Steam path)
  installerPath?: string; // Path to the installer executable (if used)
  installedFiles?: string[]; // Legacy: Relative paths of all installed files (kept for migration)
  installedPlatform?: Platform; // Platform on which the localization was installed (steam, epic, gog, etc.)
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
  phase?: 'download' | 'install';
}

export interface InstallResult {
  success: boolean;
  paused?: boolean;
  /**
   * Launch options for the game couldn't be applied because Steam is running
   * and CEF isn't reachable (typically Millennium-modded Steam). Renderer can
   * offer the user a "restart Steam to apply" prompt that calls
   * `applyPendingLaunchOptions`.
   */
  launchOptionsPending?: boolean;
  /**
   * The launch options could not be written for a reason restarting Steam
   * won't fix. The install itself succeeded; without them the translation
   * runs unmodded, so it is surfaced rather than only logged.
   */
  launchOptionsError?: string;
  /**
   * Whether achievement files were actually written this install. False when
   * the user re-runs an install whose achievement archive hash matches what's
   * already on disk — used to suppress the "restart Steam for achievements"
   * prompt in that case.
   */
  achievementsChanged?: boolean;
  error?: {
    message: string;
    needsManualSelection?: boolean;
    isRateLimit?: boolean;
    isNetworkError?: boolean;
  };
}

export interface InstallOptions {
  createBackup: boolean;
  installText: boolean;
  installVoice: boolean;
  installAchievements: boolean;
  platform: Platform | 'auto';
  protonPath?: string;
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
  tagIds?: number[];
  showAdultGames?: boolean;
  hideAiTranslations?: boolean;
  sortOrder?: SortOrderType;
}

export interface GetGamesResult {
  games: Game[];
  total: number;
  uniqueCount?: number; // Count of unique games by slug (for filters)
}

export interface TagOption {
  tagid: number;
  name: string;
  count: number;
}

// Content-type filters - multi-select, combined with AND (both can be selected at once)
export type ContentTypeFilterType = 'with-achievements' | 'with-voice' | 'from-workshop';

// Special filters that are single-select (library/ownership source - mutually exclusive)
export type SpecialFilterType =
  | 'installed-translations'
  | 'installed-games'
  | 'available-in-steam'
  | 'owned-gog-games'
  | 'owned-epic-games'
  | 'installed-xbox-games'
  | 'favorite-translations';

/**
 * Input for faceted (real e-commerce style) filter counts: the current staged
 * filter selection plus the raw system/library data needed to resolve the
 * 7 special-filter membership sets - resolved client-side the same way the
 * game list itself resolves them (see useGames.ts), since favorites/installed
 * translations/Steam-GOG-Epic-Xbox libraries aren't SQL-native concepts.
 */
export interface FacetedFilterCountsRequest {
  searchQuery?: string;
  statuses?: string[];
  authors?: string[];
  tagIds?: number[];
  contentTypes?: ContentTypeFilterType[];
  specialFilter?: SpecialFilterType | null;
  hideAiTranslations?: boolean;
  /** Full author list (e.g. getUniqueAuthors()/the already-loaded `authors` prop) to compute per-author counts against. */
  knownAuthors: string[];

  favoriteGameIds: string[];
  installedTranslationGameIds: string[];
  installedGamePaths: string[];
  steamLibraryAppIds: number[];
  gogTitles: string[];
  epicTitles: string[];
  xboxFolderNames: string[];
}

export interface FacetOptionCount {
  /** Resulting count if this option is the only active value in its group, combined with every other active filter. */
  total: number;
  /** How many games this option would ADD to the currently visible list if also selected (OR-groups only). */
  added: number;
}

export interface FacetedFilterCounts {
  statuses: Record<string, FacetOptionCount>;
  tags: Record<number, FacetOptionCount>;
  authors: Record<string, FacetOptionCount>;
  contentTypes: Record<ContentTypeFilterType, number>;
  specialFilters: Record<SpecialFilterType, number>;
}

export interface DetectedGameInfo {
  platform: Database['public']['Enums']['install_source'];
  path: string;
  exists: boolean;
}

export interface DetectedGame {
  gameId: string;
  platform: Database['public']['Enums']['install_source'];
  path: string;
}

export interface LaunchGameResult {
  success: boolean;
  error?: string;
}

export interface FeedbackReplyPayload {
  replyId: string;
  gameId: string;
  gameName: string;
  message: string;
  createdAt: string;
}

export type SteamBridgeFailure = 'cef-unavailable' | 'steam-not-running' | 'failed';

export type SteamLibraryFailure = SteamBridgeFailure | 'library-unavailable';

export type SteamCollectionSyncFailure =
  | SteamLibraryFailure
  | 'no-translated-games'
  | 'no-matches';

export interface ElectronAPI {
  fetchGames: (params?: GetGamesParams) => Promise<GetGamesResult>;
  fetchTagOptions: () => Promise<TagOption[]>;
  fetchTeams: () => Promise<string[]>;
  fetchFacetedFilterCounts: (
    request: FacetedFilterCountsRequest
  ) => Promise<FacetedFilterCounts>;
  fetchTrendingGames: (
    days?: number,
    limit?: number
  ) => Promise<{ game_id: string; downloads: number }[]>;
  fetchGamesByIds: (
    gameIds: string[],
    searchQuery?: string,
    showAiTranslations?: boolean,
    sortOrder?: SortOrderType
  ) => Promise<Game[]>;
  fetchRecommendedGames: (
    gameId: string,
    limit?: number,
    hideAiTranslations?: boolean
  ) => Promise<Game[]>;
  syncKurinGames: () => Promise<string[]>;
  getAllInstalledGamePaths: () => Promise<string[]>;
  getDetectedGames: () => Promise<DetectedGame[]>;
  getAvailableProtons: () => Promise<Array<{ name: string; path: string }>>;
  findGamesByInstallPaths: (
    installPaths: string[],
    searchQuery?: string,
    showAiTranslations?: boolean,
    sortOrder?: SortOrderType
  ) => Promise<GetGamesResult>;
  getSteamLibraryAppIds: () => Promise<number[]>;
  findGamesBySteamAppIds: (
    steamAppIds: number[],
    searchQuery?: string,
    hideAiTranslations?: boolean,
    sortOrder?: SortOrderType
  ) => Promise<GetGamesResult>;
  countGamesBySteamAppIds: (steamAppIds: number[]) => Promise<number>;
  findGamesByTitles: (
    titles: string[],
    searchQuery?: string,
    hideAiTranslations?: boolean,
    sortOrder?: SortOrderType
  ) => Promise<GetGamesResult>;
  getGogLibrary: () => Promise<string[]>;
  getEpicLibrary: () => Promise<string[]>;
  getXboxInstalledPaths: () => Promise<string[]>;
  findGamesByXboxPaths: (
    folderNames: string[],
    searchQuery?: string,
    hideAiTranslations?: boolean,
    sortOrder?: SortOrderType
  ) => Promise<GetGamesResult>;
  detectGamePlatforms: (game: Game) => Promise<GamePath[]>;
  installTranslation: (
    game: Game,
    options: InstallOptions,
    customGamePath?: string
  ) => Promise<InstallResult>;
  uninstallTranslation: (game: Game) => Promise<InstallResult>;
  rerunInstaller: (installerPath: string, protonPath?: string) => Promise<InstallResult>;
  showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Fires after the installer/script has been downloaded and extracted, before it
   * runs, so the renderer can ask the user whether to launch it now. The renderer
   * must eventually call `respondRunInstaller` with the same gameId or the install
   * promise on the main process stays pending forever.
   */
  onRequestRunInstallerConfirm: (
    callback: (gameId: string, installerPath: string, isExe: boolean) => void
  ) => () => void;
  respondRunInstaller: (gameId: string, shouldRun: boolean) => void;
  abortDownload: (reason?: string) => Promise<{ success: boolean }>;
  pauseDownload: (
    gameId: string
  ) => Promise<{ success: boolean; state?: PausedDownloadState; error?: string }>;
  resumeDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  getPausedDownload: (gameId: string) => Promise<PausedDownloadState | null>;
  cancelPausedDownload: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  checkInstallation: (game: Game) => Promise<InstallationInfo | null>;
  getConflictingTranslation: (game: Game) => Promise<ConflictingTranslation | null>;
  setGameVisibility: (gameId: string, hidden: boolean) => Promise<boolean>;
  getAllInstalledGameIds: () => Promise<string[]>;
  removeOrphanedMetadata: (gameIds: string[]) => Promise<{ success: boolean }>;
  removeComponents: (
    game: Game,
    componentsToRemove: { voice?: boolean; achievements?: boolean }
  ) => Promise<InstallResult>;
  checkPlatformCompatibility: (game: Game) => Promise<string | null>;
  fetchNewsFeed: (filter: NewsFeedFilter, before?: string) => Promise<NewsFeedItem[]>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  selectGameFolder: () => Promise<string | null>;
  onInstallProgress: (callback: (progress: number) => void) => () => void;
  onDownloadProgress: (
    callback: (gameId: string, progress: DownloadProgress) => void
  ) => () => void;
  onInstallationStatus: (
    callback: (gameId: string, status: InstallationStatus) => void
  ) => () => void;
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
  fetchChangelog: (version: string) => Promise<ChangelogEntry[] | null>;
  // Real-time updates (автоматично керуються в main process)
  onGameUpdated: (callback: (game: Game) => void) => () => void;
  onGameRemoved: (callback: (gameId: string) => void) => () => void;
  isGameTombstoned: (gameId: string) => Promise<boolean>;
  onGameTombstoned: (callback: (gameId: string) => void) => () => void;
  // Feedback replies (admin/owner → this install). `live=false` = silent catch-up.
  onFeedbackReply: (
    callback: (reply: FeedbackReplyPayload, live: boolean) => void
  ) => () => void;
  /** Kick main to replay replies missed while offline (delivered via onFeedbackReply). */
  syncFeedbackReplies: () => Promise<void>;
  // Game detection
  onSteamLibraryChanged?: (callback: () => void) => () => void;
  onTestGamesChanged?: (callback: () => void) => () => void; // DEV ONLY
  onInstalledGamesChanged?: (callback: () => void) => () => void;
  // Game launcher
  launchGame: (game: Game) => Promise<LaunchGameResult>;
  // Steam integration
  restartSteam: () => Promise<{ success: boolean; error?: string }>;
  applyPendingLaunchOptions: (
    game: Game
  ) => Promise<{ success: boolean; error?: string }>;
  /** Steam restart needed for the CEF port; fired from the Settings CEF toggle. */
  onSteamRestartRequired: (callback: () => void) => () => void;
  /** Create (true) or remove (false) Steam's `.cef-enable-remote-debugging` flag file. */
  setSteamCefDebugging: (enabled: boolean) => Promise<void>;
  /** Turning it off reverts Ukrainian library artwork already installed. */
  setSteamCustomArtwork: (enabled: boolean) => Promise<void>;
  /**
   * Create or update the Steam library collection «З українізаторами» with
   * every owned game that has a translation in the catalog. Re-running it
   * also drops games whose translation disappeared since the last sync.
   */
  syncSteamTranslatedCollection: () => Promise<
    | { ok: true; total: number }
    | { ok: false; reason: SteamCollectionSyncFailure; error?: string }
  >;
  /**
   * Add (or update) LBK Launcher itself as a non-Steam shortcut in the
   * user's Steam library, with name/icon/artwork — so it's launchable from
   * Big Picture / Steam Deck Gaming Mode. Safe to call repeatedly: reuses
   * the shortcut it created before instead of adding a duplicate.
   */
  addLbkLauncherToSteamLibrary: () => Promise<
    { ok: true } | { ok: false; reason: SteamLibraryFailure; error?: string }
  >;
  // Version
  getVersion: () => string;
  // E2E test mode — disables analytics/tracking
  isE2E: () => boolean;
  // Platform
  getPlatform: () => string;
  // Hardware info from Node `os` module — accurate, no Chromium 8GB cap.
  getSystemInfo: () => { totalRamGB: number; cpuCount: number };
  // Machine ID - for subscription tracking
  getMachineId: () => Promise<string | null>;
  // Track subscription events
  trackSubscription: (
    gameId: string,
    action: 'subscribe' | 'unsubscribe'
  ) => Promise<{ success: boolean; error?: string }>;
  // Track support click events
  trackSupportClick: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  // Підписка й відписка на переклад у Майстерні без відкриття Steam
  setWorkshopSubscription: (
    gameId: string,
    appId: number,
    workshopId: string,
    subscribe: boolean
  ) => Promise<{ ok: true } | { ok: false; reason: SteamBridgeFailure; error?: string }>;
  /** Які воркшоп-переклади з каталогу вже на диску; null — містка немає */
  listInstalledWorkshopGames: () => Promise<string[] | null>;
  /** Факт наявності на диску; null — CEF-місток недоступний, відповіді немає */
  isWorkshopItemDownloaded: (
    appId: number,
    workshopId: string
  ) => Promise<boolean | null>;
  // Перехід у Майстерню рахується як завантаження
  trackWorkshopOpen: (
    gameId: string,
    isFirstSession?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  // Track failed search (0 results)
  trackFailedSearch: (query: string) => Promise<{ success: boolean; error?: string }>;
  // Submit feedback for a game translation
  submitFeedback: (
    gameId: string,
    type: FeedbackType,
    message: string,
    screenshotPaths?: string[]
  ) => Promise<{ success: boolean; error?: string }>;
  submitLogs: (
    message: string,
    crashReason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Get signed upload URLs for feedback screenshots
  getFeedbackUploadUrls: (fileNames: string[]) => Promise<{
    success: boolean;
    uploadUrls?: { fileName: string; path: string; signedUrl: string; token: string }[];
    error?: string;
  }>;
  // Upload a file to a signed URL
  uploadFileToSignedUrl: (
    signedUrl: string,
    filePath: string,
    contentType: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Deep link handling
  onDeepLink: (callback: (data: { slug: string; team: string }) => void) => () => void;
  /** Tell main the renderer's IPC listeners are registered (flushes a buffered deep link). */
  notifyReady: () => void;
  // Sync status
  onSyncStatus: (callback: (status: 'syncing' | 'ready' | 'error') => void) => () => void;
  getSyncStatus: () => Promise<'syncing' | 'ready' | 'error'>;
  // Banner API
  fetchPromoBanner: () => Promise<BannerData | null>;
  fetchBannersForGame: (gameId: string, gameSlug: string) => Promise<GameBannersResult>;
  recordPromoBannerImpression: (params: {
    campaignId: string;
    impressionType: ImpressionType;
    gameSlug?: string;
  }) => Promise<boolean>;
  recordBannerImpression: (
    bannerId: string,
    impressionType?: ImpressionType
  ) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
