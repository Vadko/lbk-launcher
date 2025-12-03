import { create } from 'zustand';
import { Game } from '../types/game';
import { fetchGames } from '../utils/api';
import type { DownloadProgress, InstallationInfo, DetectedGameInfo, Database } from '../../shared/types';
import { useSettingsStore } from './useSettingsStore';

type FilterType = 'all' | Database['public']['Enums']['game_status'] | 'installed-games';

interface InstallationProgress {
  isInstalling: boolean;
  isUninstalling: boolean;
  progress: number;
  downloadProgress: DownloadProgress | null;
  statusMessage: string | null;
}

interface Store {
  installedGames: Map<string, InstallationInfo>;  // Installed games info (with translation)
  detectedGames: Map<string, DetectedGameInfo>;  // Detected games on system (actual game files)
  paginatedGames: Game[];  // Games loaded via pagination
  installedGamePaths: string[];  // Cached list of all installed game paths
  selectedGame: Game | null;
  filter: FilterType;
  searchQuery: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  gamesWithUpdates: Set<string>;
  isInitialLoad: boolean;
  installationProgress: Map<string, InstallationProgress>;
  isCheckingInstallation: Map<string, boolean>;
  currentOffset: number;
  itemsPerPage: number;
  totalGames: number;
  hasMore: boolean;
  prefetchedGames: Game[];  // Prefetched next page
  isPrefetching: boolean;

  // Actions
  fetchGames: () => Promise<void>;
  loadMoreGames: () => Promise<void>;
  prefetchNextPage: () => Promise<void>;
  setSelectedGame: (game: Game | null) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void; // Only updates state, doesn't fetch
  updateGame: (updatedGame: Game) => void;
  initRealtimeSubscription: () => void;
  loadInstalledGames: () => Promise<void>;
  detectInstalledGames: () => Promise<void>;
  checkInstallationStatus: (gameId: string) => Promise<void>;
  checkForGameUpdate: (gameId: string, newVersion: string) => boolean;
  markGameAsUpdated: (gameId: string) => void;
  clearGameUpdate: (gameId: string) => void;
  setInitialLoadComplete: () => void;
  setInstallationProgress: (gameId: string, progress: Partial<InstallationProgress>) => void;
  clearInstallationProgress: (gameId: string) => void;
  getInstallationProgress: (gameId: string) => InstallationProgress | undefined;
  getInstallationInfo: (gameId: string) => InstallationInfo | undefined;
  getDetectedGameInfo: (gameId: string) => DetectedGameInfo | undefined;
  isGameDetected: (gameId: string) => boolean;
  isCheckingInstallationStatus: (gameId: string) => boolean;
}

export const useStore = create<Store>((set, get) => ({
  installedGames: new Map(),
  detectedGames: new Map(),
  paginatedGames: [],
  installedGamePaths: [],
  selectedGame: null,
  filter: 'all',
  searchQuery: '',
  isLoading: false,
  isLoadingMore: false,
  error: null,
  gamesWithUpdates: new Set(),
  isInitialLoad: true,
  installationProgress: new Map(),
  isCheckingInstallation: new Map(),
  currentOffset: 0,
  itemsPerPage: 10,
  totalGames: 0,
  hasMore: false,
  prefetchedGames: [],
  isPrefetching: false,

  fetchGames: async () => {
    set({ isLoading: true, error: null, currentOffset: 0, paginatedGames: [], prefetchedGames: [] });
    try {
      const { filter, searchQuery, itemsPerPage } = get();

      // Special handling for "installed-games" filter
      if (filter === 'installed-games') {
        console.log('[Store] Fetching installed games from system');

        try {
          // Step 1: Get ALL installed game paths from the system (cache them)
          const installedPaths = await window.electronAPI.getAllInstalledGamePaths();
          console.log('[Store] Found', installedPaths.length, 'installed game paths on system');

          // Step 2: Query server for games that match these paths (with pagination)
          const result = await window.electronAPI.findGamesByInstallPaths(installedPaths, 0, itemsPerPage);
          console.log('[Store] Found', result.games.length, 'games in database matching installed paths, total:', result.total);

          set({
            installedGamePaths: installedPaths, // Cache for loadMore
            paginatedGames: result.games,
            currentOffset: itemsPerPage,
            totalGames: result.total,
            hasMore: result.hasMore,
            isLoading: false,
            error: null,
          });

          // Detect which games are installed on the system (if enabled)
          if (useSettingsStore.getState().autoDetectInstalledGames) {
            await get().detectInstalledGames();
          }

          // Prefetch next page in background
          get().prefetchNextPage();
        } catch (error) {
          console.error('[Store] Error fetching installed games:', error);
          set({
            paginatedGames: [],
            totalGames: 0,
            hasMore: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch installed games',
          });
        }
        return;
      }

      // Normal flow for other filters
      // Step 1: Get all installed game IDs (remove duplicates)
      const installedGameIds = [...new Set(await window.electronAPI.getAllInstalledGameIds())];
      console.log('[Store] Found installed game IDs:', installedGameIds);

      // Step 2: Fetch installed games data (for update checks)
      const installedGamesData = await window.electronAPI.fetchGamesByIds(installedGameIds);
      console.log('[Store] Fetched installed games:', installedGamesData);

      // Step 3: Fetch first page of paginated games
      const result = await fetchGames({
        offset: 0,
        limit: itemsPerPage,
        searchQuery,
        filter,
      });

      console.log('[Store] Fetched paginated games:', result);

      // Filter installed games by current filter and search
      const filteredInstalledGames = installedGamesData.filter((game) => {
        // Filter by status
        if (filter !== 'all' && game.status !== filter) {
          return false;
        }

        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return game.name.toLowerCase().includes(query);
        }

        return true;
      });

      // Merge: installed games first, then paginated (avoiding duplicates)
      const seenIds = new Set<string>();
      const allGames: Game[] = [];

      // Add filtered installed games first
      for (const game of filteredInstalledGames) {
        if (!seenIds.has(game.id)) {
          seenIds.add(game.id);
          allGames.push(game);
        }
      }

      // Add paginated games (excluding already added installed games)
      for (const game of result.games) {
        if (!seenIds.has(game.id)) {
          seenIds.add(game.id);
          allGames.push(game);
        }
      }

      set({
        paginatedGames: allGames,
        currentOffset: itemsPerPage,
        totalGames: result.total,
        hasMore: result.hasMore,
        isLoading: false,
      });

      // Detect which games are installed on the system (if enabled)
      if (useSettingsStore.getState().autoDetectInstalledGames) {
        await get().detectInstalledGames();
      }

      // Prefetch next page in background
      get().prefetchNextPage();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch games',
        isLoading: false,
      });
    }
  },

  loadMoreGames: async () => {
    const { isLoadingMore, hasMore, currentOffset, itemsPerPage, filter, searchQuery, paginatedGames, installedGamePaths, prefetchedGames } = get();

    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });

    try {
      let result;

      // Check if we have prefetched data available
      if (prefetchedGames.length > 0) {
        console.log('[Store] Using prefetched games:', prefetchedGames.length);
        result = {
          games: prefetchedGames,
          total: get().totalGames,
          hasMore: currentOffset + itemsPerPage < get().totalGames,
        };
        // Clear prefetched games
        set({ prefetchedGames: [] });
      } else {
        // Server-side pagination for installed-games filter (using cached paths)
        if (filter === 'installed-games' && installedGamePaths.length > 0) {
          result = await window.electronAPI.findGamesByInstallPaths(
            installedGamePaths,
            currentOffset,
            itemsPerPage
          );
        } else {
          // Server-side pagination for other filters
          result = await fetchGames({
            offset: currentOffset,
            limit: itemsPerPage,
            searchQuery,
            filter,
          });
        }
      }

      // Avoid duplicates when adding more games
      const existingIds = new Set(paginatedGames.map(g => g.id));
      const newGames = result.games.filter(g => !existingIds.has(g.id));

      set((state) => ({
        paginatedGames: [...state.paginatedGames, ...newGames],
        currentOffset: currentOffset + itemsPerPage,
        hasMore: result.hasMore,
        isLoadingMore: false,
      }));

      // Re-detect games after loading more (if enabled)
      if (useSettingsStore.getState().autoDetectInstalledGames) {
        await get().detectInstalledGames();
      }

      // Prefetch next page in background
      get().prefetchNextPage();
    } catch (error) {
      console.error('Error loading more games:', error);
      set({ isLoadingMore: false });
    }
  },

  prefetchNextPage: async () => {
    const { isPrefetching, hasMore, currentOffset, itemsPerPage, filter, searchQuery, installedGamePaths } = get();

    // Don't prefetch if already prefetching or no more pages
    if (isPrefetching || !hasMore) return;

    set({ isPrefetching: true });

    try {
      let result;

      // Server-side pagination for installed-games filter (using cached paths)
      if (filter === 'installed-games' && installedGamePaths.length > 0) {
        result = await window.electronAPI.findGamesByInstallPaths(
          installedGamePaths,
          currentOffset,
          itemsPerPage
        );
      } else {
        // Server-side pagination for other filters
        result = await fetchGames({
          offset: currentOffset,
          limit: itemsPerPage,
          searchQuery,
          filter,
        });
      }

      console.log('[Store] Prefetched', result.games.length, 'games for next page');

      set({
        prefetchedGames: result.games,
        isPrefetching: false,
      });
    } catch (error) {
      console.error('[Store] Error prefetching next page:', error);
      set({ isPrefetching: false });
    }
  },

  setSelectedGame: (game) => set({ selectedGame: game }),

  setFilter: (filter) => {
    set({ filter });
    // Always fetch games to ensure we have data for detection
    get().fetchGames();
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    // Don't fetch here - component will handle debounced fetch
  },

  updateGame: (updatedGame) =>
    set((state) => {
      let paginatedGames: Game[];
      if (state.paginatedGames.find((game) => game.id === updatedGame.id)) {
        paginatedGames = state.paginatedGames.map((game) =>
          game.id === updatedGame.id ? updatedGame : game
        );
      } else {
        paginatedGames = [...state.paginatedGames, updatedGame].sort((gameA, gameB) => {
          // Sort installed games first
          const aInstalled = state.installedGames.has(gameA.id);
          const bInstalled = state.installedGames.has(gameB.id);
          if (aInstalled && !bInstalled) return -1;
          if (!aInstalled && bInstalled) return 1;
          return gameA.name.localeCompare(gameB.name);
        });
      }

      // Update selected game if it's the one that was updated
      const selectedGame =
        state.selectedGame?.id === updatedGame.id ? updatedGame : state.selectedGame;

      // Check if this game has an update available
      if (updatedGame.version) {
        const hasUpdate = get().checkForGameUpdate(updatedGame.id, updatedGame.version);
        if (hasUpdate) {
          get().markGameAsUpdated(updatedGame.id);
        }
      }

      return { paginatedGames, selectedGame };
    }),

  loadInstalledGames: async () => {
    if (!window.electronAPI) return;

    const games = get().paginatedGames;
    const installedGamesMap = new Map<string, InstallationInfo>();
    const gamesWithUpdatesSet = new Set<string>();

    for (const game of games) {
      const installInfo = await window.electronAPI.checkInstallation(game);
      if (installInfo) {
        installedGamesMap.set(game.id, installInfo);

        // Check if installed version differs from current version in DB
        if (game.version && installInfo.version !== game.version) {
          gamesWithUpdatesSet.add(game.id);

          // Show in-app notification for this game
          window.electronAPI.showGameUpdateNotification?.(
            game.name,
            game.version,
            true // isInitialLoad - skip system notification
          );
        }
      }
    }

    set({
      installedGames: installedGamesMap,
      gamesWithUpdates: gamesWithUpdatesSet,
    });
  },

  checkInstallationStatus: async (gameId: string) => {
    if (!window.electronAPI) return;

    // Find game in store
    const state = get();
    const game = state.paginatedGames.find(g => g.id === gameId);

    if (!game) {
      console.warn(`[Store] Game ${gameId} not found in store`);
      return;
    }

    set((state) => {
      const newMap = new Map(state.isCheckingInstallation);
      newMap.set(gameId, true);
      return { isCheckingInstallation: newMap };
    });

    try {
      const info = await window.electronAPI.checkInstallation(game);

      set((state) => {
        const newInstalledGames = new Map(state.installedGames);
        if (info) {
          newInstalledGames.set(gameId, info);
        } else {
          newInstalledGames.delete(gameId);
        }

        const newChecking = new Map(state.isCheckingInstallation);
        newChecking.set(gameId, false);

        return {
          installedGames: newInstalledGames,
          isCheckingInstallation: newChecking,
        };
      });
    } catch (error) {
      console.error('Error checking installation:', error);
      set((state) => {
        const newChecking = new Map(state.isCheckingInstallation);
        newChecking.set(gameId, false);
        return { isCheckingInstallation: newChecking };
      });
    }
  },

  checkForGameUpdate: (gameId: string, newVersion: string) => {
    const state = get();
    const installedGame = state.installedGames.get(gameId);

    if (!installedGame) return false;

    return installedGame.version !== newVersion;
  },

  markGameAsUpdated: (gameId: string) => {
    set((state) => {
      const newSet = new Set(state.gamesWithUpdates);
      newSet.add(gameId);
      return { gamesWithUpdates: newSet };
    });
  },

  clearGameUpdate: (gameId: string) => {
    set((state) => {
      const newSet = new Set(state.gamesWithUpdates);
      newSet.delete(gameId);
      return { gamesWithUpdates: newSet };
    });
  },

  setInitialLoadComplete: () => {
    set({ isInitialLoad: false });
  },

  setInstallationProgress: (gameId: string, progress: Partial<InstallationProgress>) => {
    set((state) => {
      const newMap = new Map(state.installationProgress);
      const currentProgress = newMap.get(gameId) || {
        isInstalling: false,
        isUninstalling: false,
        progress: 0,
        downloadProgress: null,
        statusMessage: null,
      };
      newMap.set(gameId, { ...currentProgress, ...progress });
      return { installationProgress: newMap };
    });
  },

  clearInstallationProgress: (gameId: string) => {
    set((state) => {
      const newMap = new Map(state.installationProgress);
      newMap.delete(gameId);
      return { installationProgress: newMap };
    });
  },

  getInstallationProgress: (gameId: string) => {
    return get().installationProgress.get(gameId);
  },

  getInstallationInfo: (gameId: string) => {
    return get().installedGames.get(gameId);
  },

  isCheckingInstallationStatus: (gameId: string) => {
    return get().isCheckingInstallation.get(gameId) || false;
  },

  detectInstalledGames: async () => {
    if (!window.electronAPI) return;

    const games = get().paginatedGames;

    try {
      const detectedGamesMap = await window.electronAPI.detectGames(games);
      const newDetectedGames = new Map<string, DetectedGameInfo>();

      for (const [gameId, gameInfo] of Object.entries(detectedGamesMap)) {
        newDetectedGames.set(gameId, gameInfo);
      }

      console.log('[Store] Detected games on system:', newDetectedGames.size);
      set({ detectedGames: newDetectedGames });
    } catch (error) {
      console.error('[Store] Error detecting games:', error);
    }
  },

  getDetectedGameInfo: (gameId: string) => {
    return get().detectedGames.get(gameId);
  },

  isGameDetected: (gameId: string) => {
    return get().detectedGames.has(gameId);
  },

  initRealtimeSubscription: () => {
    if (!window.electronAPI) return;

    // Subscribe to game updates
    window.electronAPI.subscribeGameUpdates();

    // Listen for updates
    window.electronAPI.onGameUpdated((updatedGame) => {
      console.log('Game updated via real-time:', updatedGame);
      const state = useStore.getState();

      // Check if game is installed and has an update
      const isInstalled = state.installedGames.has(updatedGame.id);

      if (updatedGame.version) {
        const hasUpdate = state.checkForGameUpdate(updatedGame.id, updatedGame.version);

        if (isInstalled && hasUpdate) {
          // Send notification request to main process
          // Note: system notifications are controlled in main process based on isInitialLoad
          // In-app notifications are controlled by gameUpdateNotificationsEnabled in the component
          window.electronAPI.showGameUpdateNotification?.(
            updatedGame.name,
            updatedGame.version,
            state.isInitialLoad
          );
        }
      }

      state.updateGame(updatedGame);
    });
  },
}));

// Selector for paginated games (server-side pagination + installed games first)
export const useVisibleGames = () => {
  const { paginatedGames, totalGames, hasMore, isLoading, isLoadingMore } = useStore();

  return {
    games: paginatedGames,
    totalGames,
    hasMore,
    isLoading,
    isLoadingMore,
  };
};
