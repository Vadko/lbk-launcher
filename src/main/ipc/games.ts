import os from 'node:os';
import { app, ipcMain } from 'electron';
import { errorMessage } from '@/shared/errors';
import { t } from '@/shared/i18n/i18n';
import type { Game, GetGamesParams, SortOrderType } from '../../shared/types';
import {
  fetchGames,
  fetchGamesByIds,
  fetchRecommendedGames,
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
import { notifyCountersUpdated } from '../db/counters-updated';
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
import { checkStoreLibraries } from '../store-library-watcher';
import {
  getMachineId,
  submitLogs,
  trackFailedSearch,
  trackSubscription,
  trackSupportClick,
  trackUninstall,
  trackWorkshopOpen,
} from '../tracking';
import { launchEglGame } from '../utils/egl-launcher';
import { flushEglLaunchArgs } from '../utils/egl-windows-settings';
import { launchEpicGame } from '../utils/epic-launcher';
import { launchHeroicGame } from '../utils/heroic-launcher';
import { createTimer } from '../utils/logger';
import { getPlatform } from '../utils/platform';
import { syncTranslatedGamesCollection } from '../utils/steam-collections';
import { launchSteamGame } from '../utils/steam-launcher';
import { addLbkLauncherToSteamLibrary } from '../utils/steam-self-shortcut';
import {
  installedWorkshopGameIds,
  isWorkshopItemDownloaded,
  setWorkshopSubscription,
} from '../utils/steam-workshop';
import { launchUplayGame } from '../utils/uplay-launcher';
import { createHandleOr, orEmpty, orNull } from './handle-or';

const handleOr = createHandleOr('Games');

const noGames = () => ({ games: [], total: 0 });

interface PromoImpression {
  campaignId: string;
  impressionType: ImpressionType;
  gameSlug?: string;
}

// The page gets an absolute image URL and a link it can open as is
const toBannerData = (banner: BannerData): BannerData => ({
  id: banner.id,
  type: banner.type,
  image_path: buildBannerImageUrl(banner.image_path) || '',
  link: banner.link || '',
});

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
          notifyCountersUpdated(repo.getGamesByIds([gameId]));
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
  handleOr(
    'list-installed-workshop-games',
    () => installedWorkshopGameIds(GamesRepository.getInstance().getWorkshopTargets()),
    orNull
  );

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

  // Send logs handler
  ipcMain.handle('submit-logs', async (_, message: string, crashReason?: string) =>
    submitLogs(message, crashReason)
  );

  // Check whether the game is marked as tombstoned
  // (removed from the catalog, but installed locally)
  ipcMain.handle('is-game-tombstoned', (_, gameId: string) =>
    SyncManager.getInstance().isGameTombstoned(gameId)
  );

  handleOr(
    'fetch-games',
    (params: GetGamesParams) => fetchGames(params),
    () => ({ games: [], total: 0, hasMore: false }),
    { timed: true }
  );

  handleOr(
    'fetch-games-by-ids',
    (
      gameIds: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) => fetchGamesByIds(gameIds, searchQuery, hideAiTranslations, false, sortOrder),
    orEmpty
  );

  handleOr(
    'find-deep-link-game-id',
    (slug: string, team: string) => findDeepLinkGameId(slug, team),
    orNull
  );

  // Recommended by Steam tag overlap
  handleOr(
    'fetch-recommended-games',
    (gameId: string, limit?: number, hideAiTranslations?: boolean) =>
      fetchRecommendedGames(gameId, limit, hideAiTranslations),
    orEmpty
  );

  handleOr(
    'fetch-search-match-ids',
    (searchQuery: string) => GamesRepository.getInstance().getSearchMatchIds(searchQuery),
    orNull
  );

  // Re-probes every store off the fingerprints; a change also emits store-library-changed
  ipcMain.handle('check-store-libraries', () => checkStoreLibraries());

  handleOr(
    'fetch-trending-games',
    (days?: number, limit?: number) => fetchTrendingGames(days, limit),
    orEmpty
  );

  handleOr('sync-kurin-games', syncKurinGames, orEmpty);

  handleOr(
    'get-all-installed-game-paths',
    async () => {
      await whenXboxRootsScanned();
      return getAllInstalledGamePaths();
    },
    orEmpty,
    { timed: true }
  );

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

  handleOr('get-available-protons', findProtons, orEmpty);

  handleOr(
    'detect-game-platforms',
    async (game: Game) => {
      await refreshXboxRootsForGame(game.install_paths);
      return detectGamePaths(game.install_paths || [], game.steam_app_id);
    },
    orEmpty
  );

  // Steam app-id matches are unioned in, as the sidebar badge (getDetectedGames) is app-id-authoritative
  handleOr(
    'find-games-by-install-paths',
    (
      installPaths: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) =>
      findGamesByInstallPaths(
        installPaths,
        searchQuery,
        hideAiTranslations,
        sortOrder,
        getInstalledSteamAppIds()
      ),
    noGames
  );

  // Owned games, installed or not
  handleOr('get-steam-library-app-ids', getSteamLibraryAppIds, orEmpty, { timed: true });

  handleOr(
    'find-games-by-steam-app-ids',
    (
      steamAppIds: number[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) => findGamesBySteamAppIds(steamAppIds, searchQuery, hideAiTranslations, sortOrder),
    noGames
  );

  handleOr('get-gog-library', getGogLibrary, orEmpty);

  handleOr(
    'find-games-by-titles',
    (
      titles: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) =>
      GamesRepository.getInstance().findGamesByTitles(
        titles,
        searchQuery,
        hideAiTranslations,
        sortOrder
      ),
    noGames
  );

  handleOr('get-epic-library', getEpicLibrary, orEmpty);

  // Folder names parsed from .GamingRoot
  handleOr(
    'get-xbox-installed-paths',
    async () => {
      await whenXboxRootsScanned();
      return getInstalledXboxGamePaths();
    },
    orEmpty
  );

  // Matched against install_paths
  handleOr(
    'find-games-by-xbox-paths',
    (
      folderNames: string[],
      searchQuery?: string,
      hideAiTranslations?: boolean,
      sortOrder: SortOrderType = 'name'
    ) =>
      GamesRepository.getInstance().findGamesByXboxPaths(
        folderNames,
        searchQuery,
        hideAiTranslations,
        sortOrder
      ),
    noGames
  );

  handleOr(
    'launch-game',
    async (game: Game) => {
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
    },
    (error) => ({ success: false, error: errorMessage(error, t('launch.failed')) })
  );

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

  handleOr(
    'fetch-promo-banner',
    async (): Promise<BannerData | null> => {
      const promoBanner = await fetchGlobalBanner({
        machineId: getMachineId() || undefined,
      });
      return promoBanner && toBannerData(promoBanner);
    },
    orNull
  );

  handleOr(
    'record-promo-banner-impression',
    ({ campaignId, impressionType, gameSlug }: PromoImpression) =>
      recordBannerImpression({
        campaignId,
        impressionType,
        gameSlug,
        machineId: getMachineId(),
      }),
    () => false
  );

  handleOr(
    'fetch-banners-for-game',
    async (gameId: string, gameSlug: string): Promise<GameBannersResult> => {
      const result = await fetchBannersForGame({
        gameId,
        gameSlug,
        machineId: getMachineId() || undefined,
      });
      return {
        banner: result.banner && toBannerData(result.banner),
        isKuli: result.isKuli,
      };
    },
    () => ({ banner: null, isKuli: false })
  );

  // Placement banners, viewed or clicked
  handleOr(
    'record-banner-impression',
    async (bannerId: string, impressionType: ImpressionType = 'view') => {
      await recordBannerImpression({
        campaignId: bannerId,
        impressionType,
        machineId: getMachineId(),
      });
      return true;
    },
    () => false
  );
}
