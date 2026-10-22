import os from 'node:os';
import { app, ipcMain } from 'electron';
import { t } from '@/shared/i18n/i18n';
import type { Game, GetGamesParams, SortOrderType } from '../../shared/types';
import {
  fetchGames,
  fetchGamesByIds,
  fetchRecommendedGames,
  fetchTagOptions,
  fetchTeams,
  findGamesByInstallPaths,
  findGamesBySteamAppIds,
} from '../api';
import {
  type BannerData,
  buildBannerImageUrl,
  fetchBannersForGame,
  fetchGlobalBanner,
  type GameBannersResult,
  type ImpressionType,
  recordBannerImpression,
} from '../db/banners-api';
import { findDeepLinkGameId } from '../db/deep-link-game';
import { GamesRepository } from '../db/games-repository';
import { fetchTrendingGames } from '../db/supabase-sync-api';
import { SyncManager } from '../db/sync-manager';
import {
  detectGamePath,
  detectGamePaths,
  getAllInstalledGamePaths,
  getDetectedGames,
  getFirstAvailableGamePath,
  getHeroicGame,
} from '../game-detector';
import { getEglInstallDirs } from '../game-detector/egl-linux';
import { getEpicAppName } from '../game-detector/epic';
import { getGOGGalaxyClientPath, getGOGGameId } from '../game-detector/gog';
import { syncKurinGames } from '../game-detector/kurin';
import { getLutrisSlug } from '../game-detector/lutris';
import { getInstalledSteamAppIds, getSteamLibraryAppIds } from '../game-detector/steam';
import {
  getEpicLibrary,
  getGogLibrary,
  getInstalledXboxGamePaths,
} from '../game-detector/store-cache';
import { getUplayGameId } from '../game-detector/uplay';
import { refreshXboxRootsForGame, whenXboxRootsScanned } from '../game-detector/xbox';
import { checkInstallation } from '../installer/cache';
import { findProtons } from '../installer/proton';
import { getLibraryMemberships } from '../library-memberships';
import { checkStoreLibraries } from '../store-library-watcher';
import {
  getFeedbackUploadUrls,
  getMachineId,
  submitFeedback,
  submitLogs,
  trackFailedSearch,
  trackSubscription,
  trackSupportClick,
  trackUninstall,
  trackWorkshopOpen,
  uploadFileToSignedUrl,
} from '../tracking';
import { launchEglGame } from '../utils/egl-launcher';
import { flushEglLaunchArgs } from '../utils/egl-windows-settings';
import { launchEpicGame } from '../utils/epic-launcher';
import { launchHeroicGame } from '../utils/heroic-launcher';
import { createTimer } from '../utils/logger';
import { getPlatform } from '../utils/platform';
import { removeAllSteamArtwork } from '../utils/steam-artwork';
import { syncTranslatedGamesCollection } from '../utils/steam-collections';
import { launchSteamGame } from '../utils/steam-launcher';
import { addLbkLauncherToSteamLibrary } from '../utils/steam-self-shortcut';
import {
  installedWorkshopGameIds,
  isWorkshopItemDownloaded,
  setWorkshopSubscription,
} from '../utils/steam-workshop';
import { launchUplayGame } from '../utils/uplay-launcher';
import { getMainWindow } from '../window';

export function setupGamesHandlers(): void {
  // Version
  ipcMain.on('get-version', (event) => {
    event.returnValue = app.getVersion();
  });

  // Platform
  ipcMain.on('get-platform', (event) => {
    event.returnValue = getPlatform();
  });

  // System info — accurate hardware specs via Node `os` (no Chromium's
  // deviceMemory cap of 8GB). Sync so the renderer can use it for initial
  // store defaults.
  ipcMain.on('get-system-info', (event) => {
    event.returnValue = {
      totalRamGB: os.totalmem() / 1024 ** 3,
      cpuCount: os.cpus().length,
    };
  });

  // Machine ID - for subscription tracking
  ipcMain.handle('get-machine-id', () => getMachineId());

  // Track subscription (subscribe/unsubscribe) from renderer
  ipcMain.handle(
    'track-subscription',
    async (_, gameId: string, action: 'subscribe' | 'unsubscribe') => {
      const result = await trackSubscription(gameId, action);
      if (result.success && typeof result.subscriptions === 'number') {
        try {
          const repo = GamesRepository.getInstance();
          repo.setSubscriptions(gameId, result.subscriptions);
          const updatedGame = repo.getGameById(gameId);
          if (updatedGame) {
            getMainWindow()?.webContents.send('game-counters-updated', [updatedGame]);
          }
        } catch (err) {
          console.error('[Games] Failed to update local subscriptions count:', err);
        }
      }
      return result;
    }
  );

  // Track support click
  ipcMain.handle('track-support-click', async (_, gameId: string) =>
    trackSupportClick(gameId)
  );

  // Attempt to subscribe via CEF; the renderer opens a deep link on failure
  ipcMain.handle(
    'set-workshop-subscription',
    async (_, gameId: string, appId: number, workshopId: string, subscribe: boolean) => {
      const result = await setWorkshopSubscription(appId, workshopId, subscribe);
      // Unsubscribing = removing the translation, counted as a regular uninstall
      if (result.ok && !subscribe) {
        void trackUninstall(gameId).catch((err) =>
          console.error('[Workshop] uninstall tracking failed:', err)
        );
      }
      return result;
    }
  );

  // Detection: which Workshop translations are already installed when the cache is empty or reset
  ipcMain.handle('list-installed-workshop-games', async () => {
    try {
      return await installedWorkshopGameIds(
        GamesRepository.getInstance().getWorkshopTargets()
      );
    } catch (error) {
      console.error('[Main] Listing installed Workshop games failed:', error);
      return null;
    }
  });

  ipcMain.handle(
    'is-workshop-item-downloaded',
    async (_, appId: number, workshopId: string) =>
      isWorkshopItemDownloaded(appId, workshopId)
  );

  // Navigating to the Workshop = install: the server counts only the first one from a machine
  ipcMain.handle(
    'track-workshop-open',
    async (_, gameId: string, isFirstSession?: boolean) =>
      trackWorkshopOpen(gameId, isFirstSession)
  );

  // Track failed search (0 results)
  ipcMain.handle('track-failed-search', async (_, query: string) =>
    trackFailedSearch(query)
  );

  // Submit feedback for a game translation
  ipcMain.handle(
    'submit-feedback',
    async (
      _,
      gameId: string,
      type: string,
      message: string,
      screenshotPaths?: string[]
    ) => submitFeedback(gameId, type, message, screenshotPaths)
  );

  // Send logs handler
  ipcMain.handle('submit-logs', async (_, message: string, crashReason?: string) =>
    submitLogs(message, crashReason)
  );

  // Get signed upload URLs for feedback screenshots
  ipcMain.handle('get-feedback-upload-urls', async (_, fileNames: string[]) =>
    getFeedbackUploadUrls(fileNames)
  );

  // Upload file to signed URL
  ipcMain.handle(
    'upload-file-to-signed-url',
    async (_, signedUrl: string, filePath: string, contentType: string) =>
      uploadFileToSignedUrl(signedUrl, filePath, contentType)
  );

  // Check whether the game is marked as tombstoned
  // (removed from the catalog, but installed locally)
  ipcMain.handle('is-game-tombstoned', (_, gameId: string) =>
    SyncManager.getInstance().isGameTombstoned(gameId)
  );

  // Fetch games with pagination - SYNC now, because it's the local DB
  ipcMain.handle('fetch-games', (_, params: GetGamesParams) => {
    const timer = createTimer('IPC: fetch-games');
    try {
      const result = fetchGames(params);
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error fetching games:', error);
      return { games: [], total: 0, hasMore: false };
    }
  });

  // Fetch games by IDs - SYNC
  ipcMain.handle(
    'fetch-games-by-ids',
    (
      _,
      gameIds: string[],
      searchQuery?: string,
      hideAiTranslations = false,
      sortOrder: SortOrderType = 'name'
    ) => {
      try {
        return fetchGamesByIds(
          gameIds,
          searchQuery,
          hideAiTranslations,
          false,
          sortOrder
        );
      } catch (error) {
        console.error('Error fetching games by IDs:', error);
        return [];
      }
    }
  );

  ipcMain.handle('find-deep-link-game-id', (_, slug: string, team: string) => {
    try {
      return findDeepLinkGameId(slug, team);
    } catch (error) {
      console.error('[DeepLink] Error finding game:', error);
      return null;
    }
  });

  // Fetch recommended games for game page (dynamically by Steam tag overlap)
  ipcMain.handle('fetch-recommended-games', (_, gameId: string, limit = 3) => {
    try {
      return fetchRecommendedGames(gameId, limit);
    } catch (error) {
      console.error('Error fetching recommended games:', error);
      return [];
    }
  });

  // Fetch Steam tag filter options - SYNC
  ipcMain.handle('fetch-tag-options', () => {
    try {
      return fetchTagOptions();
    } catch (error) {
      console.error('Error fetching tag options:', error);
      return [];
    }
  });

  // Fetch unique teams - SYNC
  ipcMain.handle('fetch-teams', () => {
    try {
      return fetchTeams();
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  });

  // Slim catalog projection for renderer-side faceted filter counts - SYNC
  ipcMain.handle('fetch-facet-rows', () => {
    try {
      return GamesRepository.getInstance().getFacetRows();
    } catch (error) {
      console.error('Error fetching facet rows:', error);
      return null;
    }
  });

  ipcMain.handle('fetch-search-match-ids', (_, searchQuery: string) => {
    try {
      return GamesRepository.getInstance().getSearchMatchIds(searchQuery);
    } catch (error) {
      console.error('Error fetching search match ids:', error);
      return null;
    }
  });

  // Re-probes every store off the fingerprints; a change also emits store-library-changed
  ipcMain.handle('check-store-libraries', () => checkStoreLibraries());

  // Store probes hit the disk, so the renderer calls this on library events, never per filter click
  ipcMain.handle('get-library-memberships', async () => {
    const timer = createTimer('IPC: get-library-memberships');
    try {
      return await getLibraryMemberships();
    } catch (error) {
      console.error('Error getting library memberships:', error);
      return null;
    } finally {
      timer.end();
    }
  });

  // Fetch trending games with download counts
  ipcMain.handle('fetch-trending-games', async (_, days = 30, limit = 10) => {
    try {
      return await fetchTrendingGames(days, limit);
    } catch (error) {
      console.error('Error fetching trending games:', error);
      return [];
    }
  });

  // Sync Kurin installed games data
  ipcMain.handle('sync-kurin-games', async () => {
    try {
      return syncKurinGames();
    } catch (error) {
      console.error('Error sync kurin games:', error);
      return [];
    }
  });

  // Get all installed game paths from the system
  ipcMain.handle('get-all-installed-game-paths', async () => {
    const timer = createTimer('IPC: get-all-installed-game-paths');
    try {
      await whenXboxRootsScanned();
      const result = getAllInstalledGamePaths();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error getting installed game paths:', error);
      return [];
    }
  });

  // Which catalog games are installed on this system (single detection pass:
  // Steam by app id, then installdir; other platforms by folder name).
  ipcMain.handle('get-detected-games', async () => {
    const timer = createTimer('IPC: get-detected-games');
    try {
      await whenXboxRootsScanned();
      return getDetectedGames();
    } catch (error) {
      // Rethrow so the renderer's catch preserves prior detection instead of
      // treating a transient failure as "nothing installed".
      console.error('[GameDetector] get-detected-games failed:', error);
      throw error;
    } finally {
      timer.end();
    }
  });

  // Get all installed Protons
  ipcMain.handle('get-available-protons', async () => {
    try {
      return findProtons();
    } catch (error) {
      console.error('Error getting available Protons:', error);
      return [];
    }
  });

  // Detect available platforms for a game
  ipcMain.handle('detect-game-platforms', async (_, game: Game) => {
    try {
      await refreshXboxRootsForGame(game.install_paths);
      return detectGamePaths(game.install_paths || [], game.steam_app_id);
    } catch (error) {
      console.error('Error detecting game platforms:', error);
      return [];
    }
  });

  // Find games by install paths - SYNC
  ipcMain.handle(
    'find-games-by-install-paths',
    (
      _,
      installPaths: string[],
      searchQuery?: string,
      hideAiTranslations = false,
      sortOrder: SortOrderType = 'name'
    ) => {
      try {
        // Union in Steam app-id matches so this stays consistent with the
        // sidebar badge (getDetectedGames), which is app-id-authoritative.
        return findGamesByInstallPaths(
          installPaths,
          searchQuery,
          hideAiTranslations,
          sortOrder,
          getInstalledSteamAppIds()
        );
      } catch (error) {
        console.error('Error finding games by install paths:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Get Steam library App IDs (owned games, installed or not)
  ipcMain.handle('get-steam-library-app-ids', async () => {
    const timer = createTimer('IPC: get-steam-library-app-ids');
    try {
      const result = await getSteamLibraryAppIds();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      console.error('Error getting Steam library App IDs:', error);
      return [];
    }
  });

  // Find games by Steam App IDs
  ipcMain.handle(
    'find-games-by-steam-app-ids',
    (
      _,
      steamAppIds: number[],
      searchQuery?: string,
      hideAiTranslations = false,
      sortOrder: SortOrderType = 'name'
    ) => {
      try {
        return findGamesBySteamAppIds(
          steamAppIds,
          searchQuery,
          hideAiTranslations,
          sortOrder
        );
      } catch (error) {
        console.error('Error finding games by Steam App IDs:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Get GOG library
  ipcMain.handle('get-gog-library', () => {
    try {
      return getGogLibrary();
    } catch (error) {
      console.error('Error getting GOG library:', error);
      return [];
    }
  });

  // Find games by titles
  ipcMain.handle(
    'find-games-by-titles',
    (
      _,
      titles: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) => {
      try {
        const repo = GamesRepository.getInstance();
        return repo.findGamesByTitles(titles, searchQuery, hideAiTranslations, sortOrder);
      } catch (error) {
        console.error('Error finding games by titles:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Get Epic library
  ipcMain.handle('get-epic-library', async () => {
    try {
      return getEpicLibrary();
    } catch (error) {
      console.error('Error getting Epic library:', error);
      return [];
    }
  });

  // Get Xbox installed game folder names (parsed from .GamingRoot)
  ipcMain.handle('get-xbox-installed-paths', async () => {
    try {
      await whenXboxRootsScanned();
      return getInstalledXboxGamePaths();
    } catch (error) {
      console.error('Error getting Xbox installed paths:', error);
      return [];
    }
  });

  // Find games by Xbox install folder names (matches against install_paths)
  ipcMain.handle(
    'find-games-by-xbox-paths',
    (
      _,
      folderNames: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) => {
      try {
        const repo = GamesRepository.getInstance();
        return repo.findGamesByXboxPaths(
          folderNames,
          searchQuery,
          hideAiTranslations,
          sortOrder
        );
      } catch (error) {
        console.error('Error finding games by Xbox paths:', error);
        return { games: [], total: 0 };
      }
    }
  );

  // Launch game
  ipcMain.handle('launch-game', async (_, game: Game) => {
    try {
      console.log('[LaunchGame] Request to launch game:', game.name, '(', game.id, ')');
      console.log(
        '[LaunchGame] Game install paths:',
        JSON.stringify(game.install_paths, null, 2)
      );

      await refreshXboxRootsForGame(game.install_paths);

      // Check if localization is installed and get platform info
      const installInfo = await checkInstallation(game);
      let gamePath = null;

      console.log('[LaunchGame] Installation info:', installInfo);

      // If localization is installed on a specific platform, use that platform
      if (installInfo?.installedPlatform) {
        console.log(
          '[LaunchGame] Using installed platform:',
          installInfo.installedPlatform
        );
        const selectedInstallPath = (game.install_paths || []).find(
          (p) => p.type === installInfo.installedPlatform
        );
        gamePath = detectGamePath(selectedInstallPath, game.steam_app_id);
      }

      // Fallback: use first available game path if platform not found
      if (!gamePath || !gamePath.exists) {
        console.log('[LaunchGame] Falling back to first available game path');
        gamePath = getFirstAvailableGamePath(game.install_paths || [], game.steam_app_id);
      }

      if (!gamePath || !gamePath.exists) {
        console.error('[LaunchGame] Game not found on system');
        return {
          success: false,
          error: t('launch.gameNotFound'),
        };
      }

      console.log(
        '[LaunchGame] Launching game:',
        game.name,
        'at',
        gamePath.path,
        'platform:',
        gamePath.platform
      );

      // For Steam games, try to launch via Steam protocol
      if (gamePath.platform === 'steam') {
        // Use game.steam_app_id if available, otherwise find by path
        let appId = game.steam_app_id?.toString() || null;

        if (!appId) {
          const { findSteamAppId } = await import('../game-launcher');
          appId = await findSteamAppId(gamePath.path);
        }

        if (appId) {
          const result = await launchSteamGame(appId);
          if (result.success) {
            return { success: true };
          }
        }
      }

      // EGLv2 on Linux has no appName for getEpicAppName and launches through its own AppImage
      if (gamePath.platform === 'epic' && getEglInstallDirs().includes(gamePath.path)) {
        return (await launchEglGame(gamePath.path, game.steam_launch_options_linux))
          ? { success: true }
          : { success: false, error: t('launch.failed') };
      }

      // For Epic games, try to launch via Epic protocol
      if (gamePath.platform === 'epic') {
        // A closed EGL reads its settings on this start, so queued launch options go in first
        await flushEglLaunchArgs().catch((error: unknown) => {
          console.warn('[LaunchGame] Queued EGL launch args not written:', error);
        });
        const epicAppId = getEpicAppName(gamePath.path);

        if (epicAppId) {
          const result = await launchEpicGame(epicAppId);
          if (result.success) {
            return { success: true };
          }
        } else {
          console.warn('[LaunchGame] Epic App ID not found for:', gamePath.path);
        }
      }

      // For Ubisoft Connect games, try to launch via uplay:// protocol
      if (gamePath.platform === 'uplay') {
        const uplayGameId = getUplayGameId(gamePath.path);

        if (uplayGameId) {
          const result = await launchUplayGame(uplayGameId);
          if (result.success) {
            return { success: true };
          }
        } else {
          console.warn('[LaunchGame] Uplay install id not found for:', gamePath.path);
        }
      }

      // Heroic / Lutris Games Launcher (Linux)
      if (getPlatform() === 'linux') {
        // Check for GOG/Epic game in Heroic
        const heroicGame = getHeroicGame(gamePath.path);
        if (heroicGame) {
          const result = await launchHeroicGame(heroicGame.appName, heroicGame.runner);
          if (result.success) {
            return { success: true };
          }
        }

        // Check for GOG/Epic game in Lutris
        const lutrisSlug = getLutrisSlug(gamePath.path);
        if (lutrisSlug) {
          const { launchLutrisGame } = await import('../utils/lutris-launcher');
          const result = await launchLutrisGame(lutrisSlug);
          if (result.success) {
            return { success: true };
          }
        }
      }

      if (gamePath.platform === 'gog') {
        // For GOG games, try to launch via GOG Galaxy client
        const clientPath = getGOGGalaxyClientPath();
        const gameId = getGOGGameId(gamePath.path);

        if (clientPath && gameId) {
          try {
            const { spawn } = await import('child_process');
            spawn(
              clientPath,
              ['/command=runGame', `/gameId=${gameId}`, `/path="${gamePath.path}"`],
              {
                detached: true,
                stdio: 'ignore',
              }
            ).unref();

            return { success: true };
          } catch (error) {
            console.error('[LaunchGame] Error launching GOG game via Galaxy:', error);
            // Fall through to direct executable launch
          }
        } else {
          console.warn(
            '[LaunchGame] GOG Galaxy client or game ID not found, falling back to direct launch'
          );
        }
      }

      // Fallback: launch executable directly
      const { launchGameExecutable } = await import('../game-launcher');
      await launchGameExecutable(gamePath.path);

      return { success: true };
    } catch (error) {
      console.error('[LaunchGame] Error launching game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t('launch.failed'),
      };
    }
  });

  // Switching off reverts covers already installed, not just future ones.
  ipcMain.handle('set-steam-custom-artwork', async (_event, enabled: boolean) => {
    if (!enabled) {
      await removeAllSteamArtwork();
    }
  });

  // Create/update the Steam collection with library games that have a translation
  ipcMain.handle('sync-steam-translated-collection', async () => {
    const appIds = GamesRepository.getInstance().getTranslatedSteamAppIds();
    return syncTranslatedGamesCollection(appIds);
  });

  // Add LBK Launcher as a non-Steam game to the Steam library (for Deck/Big Picture)
  ipcMain.handle('add-lbk-launcher-to-steam-library', () =>
    addLbkLauncherToSteamLibrary()
  );

  // ---------------------------------------------------------------------------
  // Banner API handlers - all banner functionality consolidated here
  // Low level API functions are in: src/main/db/banners-api.ts
  // ---------------------------------------------------------------------------

  // Fetch promo banner
  ipcMain.handle('fetch-promo-banner', async (): Promise<BannerData | null> => {
    try {
      const machineId = getMachineId();
      const promoBanner = await fetchGlobalBanner({ machineId: machineId || undefined });

      if (!promoBanner) {
        return null;
      }

      // Convert API banner data to frontend format
      const banner: BannerData = {
        id: promoBanner.id,
        type: promoBanner.type,
        image_path: buildBannerImageUrl(promoBanner.image_path) || '',
        link: promoBanner.link || '',
      };

      return banner;
    } catch (error) {
      console.error('[IPC] Error fetching promo banner:', error);
      return null;
    }
  });

  // Record banner impression
  ipcMain.handle(
    'record-promo-banner-impression',
    async (
      _,
      params: {
        campaignId: string;
        impressionType: ImpressionType;
        gameSlug?: string;
      }
    ): Promise<boolean> => {
      try {
        const machineId = getMachineId();

        return await recordBannerImpression({
          campaignId: params.campaignId,
          impressionType: params.impressionType,
          machineId,
          gameSlug: params.gameSlug,
        });
      } catch (error) {
        console.error('[IPC] Error recording banner impression:', error);
        return false;
      }
    }
  );

  // Fetch banners for game
  ipcMain.handle(
    'fetch-banners-for-game',
    async (_, gameId: string, gameSlug: string): Promise<GameBannersResult> => {
      try {
        const machineId = getMachineId();
        const result = await fetchBannersForGame({
          gameId,
          gameSlug,
          machineId: machineId || undefined,
        });

        if (!result.banner) {
          return {
            banner: null,
            isKuli: result.isKuli,
          };
        }

        // Convert API banner data to frontend format
        const banner: BannerData = {
          id: result.banner.id,
          type: result.banner.type,
          image_path: buildBannerImageUrl(result.banner.image_path) || '',
          link: result.banner.link || '',
        };
        return {
          banner,
          isKuli: result.isKuli,
        };
      } catch (error) {
        console.error('[IPC] Error fetching banners for game:', error);
        return {
          banner: null,
          isKuli: false,
        };
      }
    }
  );

  // Record banner impression for placement banners (view or click)
  ipcMain.handle(
    'record-banner-impression',
    async (
      _,
      bannerId: string,
      impressionType: ImpressionType = 'view'
    ): Promise<boolean> => {
      try {
        const machineId = getMachineId();
        await recordBannerImpression({
          campaignId: bannerId,
          impressionType,
          machineId,
        });
        return true;
      } catch (error) {
        console.error('[IPC] Error recording banner impression:', error);
        return false;
      }
    }
  );
}
