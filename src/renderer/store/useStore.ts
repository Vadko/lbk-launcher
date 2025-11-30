import { create } from 'zustand';
import { Game } from '../types/game';
import { fetchGames } from '../utils/api';

type FilterType = 'all' | 'in-progress' | 'completed' | 'early-access' | 'funded';

interface Store {
  games: Game[];
  selectedGame: Game | null;
  filter: FilterType;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  installedGames: Map<string, { version: string }>;
  gamesWithUpdates: Set<string>;
  isInitialLoad: boolean;

  // Actions
  fetchGames: () => Promise<void>;
  setSelectedGame: (game: Game | null) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  updateGame: (updatedGame: Game) => void;
  initRealtimeSubscription: () => void;
  loadInstalledGames: () => Promise<void>;
  checkForGameUpdate: (gameId: string, newVersion: string) => boolean;
  markGameAsUpdated: (gameId: string) => void;
  setInitialLoadComplete: () => void;
}

export const useStore = create<Store>((set, get) => ({
  games: [],
  selectedGame: null,
  filter: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  installedGames: new Map(),
  gamesWithUpdates: new Set(),
  isInitialLoad: true,

  fetchGames: async () => {
    set({ isLoading: true, error: null });
    try {
      const games = await fetchGames();
      set({ games, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch games',
        isLoading: false,
      });
    }
  },

  setSelectedGame: (game) => set({ selectedGame: game }),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  updateGame: (updatedGame) =>
    set((state) => {
      const games = state.games.map((game) =>
        game.id === updatedGame.id ? updatedGame : game
      );

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

      return { games, selectedGame };
    }),

  loadInstalledGames: async () => {
    if (!window.electronAPI) return;

    const games = get().games;
    const installedGamesMap = new Map<string, { version: string }>();
    const gamesWithUpdatesSet = new Set<string>();

    for (const game of games) {
      const installInfo = await window.electronAPI.checkInstallation(game.id);
      if (installInfo) {
        installedGamesMap.set(game.id, { version: installInfo.version });

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

  setInitialLoadComplete: () => {
    set({ isInitialLoad: false });
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

// Selector for filtered games
export const useFilteredGames = () => {
  const { games, filter, searchQuery } = useStore();

  return games.filter((game) => {
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
};
