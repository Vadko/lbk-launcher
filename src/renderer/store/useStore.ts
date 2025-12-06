import { create } from 'zustand';
import { Game } from '../types/game';
import type { DownloadProgress, InstallationInfo, DetectedGameInfo, Database } from '../../shared/types';

type FilterType = 'all' | Database['public']['Enums']['game_status'] | 'installed-games';

interface InstallationProgress {
  isInstalling: boolean;
  isUninstalling: boolean;
  progress: number;
  downloadProgress: DownloadProgress | null;
  statusMessage: string | null;
}

interface Store {
  // UI State
  selectedGame: Game | null;
  filter: FilterType;
  searchQuery: string;
  isInitialLoad: boolean;

  // Steam State
  steamGames: Map<string, string>; // installdir (lowercase) -> full path

  // Installation State
  installedGames: Map<string, InstallationInfo>; // Metadata про встановлені переклади
  detectedGames: Map<string, DetectedGameInfo>; // Ігри знайдені на системі
  gamesWithUpdates: Set<string>; // Ігри з доступними оновленнями
  installationProgress: Map<string, InstallationProgress>;
  isCheckingInstallation: Map<string, boolean>;

  // UI Actions
  setSelectedGame: (game: Game | null) => void;
  setFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  setInitialLoadComplete: () => void;

  // Steam Actions
  loadSteamGames: () => Promise<void>;
  clearSteamGamesCache: () => void;

  // Installation Actions
  loadInstalledGames: (games: Game[]) => Promise<void>;
  clearInstalledGamesCache: () => void;
  checkInstallationStatus: (gameId: string, game: Game) => Promise<void>;
  checkForGameUpdate: (gameId: string, newVersion: string) => boolean;
  markGameAsUpdated: (gameId: string) => void;
  clearGameUpdate: (gameId: string) => void;
  setInstallationProgress: (gameId: string, progress: Partial<InstallationProgress>) => void;
  clearInstallationProgress: (gameId: string) => void;
  getInstallationProgress: (gameId: string) => InstallationProgress | undefined;
  getInstallationInfo: (gameId: string) => InstallationInfo | undefined;
  isCheckingInstallationStatus: (gameId: string) => boolean;

  // Game Detection Actions
  clearDetectedGamesCache: () => void;
  detectInstalledGames: (games: Game[]) => Promise<void>;
  getDetectedGameInfo: (gameId: string) => DetectedGameInfo | undefined;
  isGameDetected: (gameId: string) => boolean;
}

// Load cached detected games from localStorage
const loadCachedDetectedGames = (): Map<string, DetectedGameInfo> => {
  try {
    const cached = localStorage.getItem('lb-detected-games');
    if (cached) {
      const obj = JSON.parse(cached);
      return new Map(Object.entries(obj));
    }
  } catch (err) {
    console.error('[Store] Error loading cached detected games:', err);
  }
  return new Map();
};

export const useStore = create<Store>((set, get) => ({
  // UI State
  selectedGame: null,
  filter: 'all',
  searchQuery: '',
  isInitialLoad: true,

  // Steam State
  steamGames: new Map(),

  // Installation State
  installedGames: new Map(),
  detectedGames: loadCachedDetectedGames(),
  gamesWithUpdates: new Set(),
  installationProgress: new Map(),
  isCheckingInstallation: new Map(),

  // UI Actions
  setSelectedGame: (game) => set({ selectedGame: game }),

  setFilter: (filter) => set({ filter }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setInitialLoadComplete: () => set({ isInitialLoad: false }),

  // Steam Actions
  loadSteamGames: async () => {
    if (!window.electronAPI) return;

    console.log('[Store] Loading Steam games...');
    const steamGamesObj = await window.electronAPI.getAllInstalledSteamGames();
    const steamGamesMap = new Map(Object.entries(steamGamesObj));

    console.log(`[Store] Loaded ${steamGamesMap.size} Steam games`);
    set({ steamGames: steamGamesMap });
  },

  clearSteamGamesCache: () => {
    console.log('[Store] Clearing Steam games cache');
    set({ steamGames: new Map() });
  },

  // Installation Actions
  loadInstalledGames: async (games: Game[]) => {
    if (!window.electronAPI) return;

    const state = get();
    const installedGamesMap = new Map(state.installedGames); // Мержимо з існуючими
    const gamesWithUpdatesSet = new Set(state.gamesWithUpdates); // Мержимо з існуючими

    // Фільтруємо тільки нові ігри, які ще не перевірені
    const gamesToCheck = games.filter(game => !installedGamesMap.has(game.id));

    if (gamesToCheck.length === 0) {
      // Всі ігри вже перевірені, нічого не робимо
      return;
    }

    console.log(`[Store] Checking installation for ${gamesToCheck.length} new games`);

    for (const game of gamesToCheck) {
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

  clearInstalledGamesCache: () => {
    console.log('[Store] Clearing installed games cache');
    set({
      installedGames: new Map(),
    });
  },

  checkInstallationStatus: async (gameId: string, game: Game) => {
    if (!window.electronAPI) return;

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

  // Game Detection Actions
  clearDetectedGamesCache: () => {
    console.log('[Store] Clearing detected games cache');
    set({ detectedGames: new Map() });
    localStorage.removeItem('lb-detected-games');
  },

  detectInstalledGames: async (games: Game[]) => {
    if (!window.electronAPI) return;

    try {
      const state = get();
      const newDetectedGames = new Map(state.detectedGames); // Мержимо з існуючими
      const steamGames = state.steamGames;

      console.log(`[Store] Detecting ${games.length} games using cached Steam data (${steamGames.size} Steam games)`);

      // Перевіряємо кожну гру використовуючи закешовані Steam дані
      for (const game of games) {
        // Пропускаємо якщо гра вже детектована
        if (newDetectedGames.has(game.id)) {
          continue;
        }

        // Перевіряємо чи є гра в Steam
        if (game.install_paths && game.install_paths.length > 0) {
          for (const installPath of game.install_paths) {
            if (installPath.type === 'steam' && installPath.path) {
              // Normalize the folder name
              const normalizedFolderName = installPath.path
                .replace(/^steamapps[/\\]common[/\\]/i, '')
                .replace(/^common[/\\]/i, '');

              const steamPath = steamGames.get(normalizedFolderName.toLowerCase());

              if (steamPath) {
                newDetectedGames.set(game.id, {
                  platform: 'steam',
                  path: steamPath,
                  exists: true,
                });
                console.log(`[Store] Detected ${game.name} at ${steamPath}`);
                break;
              }
            }
          }
        }
      }

      console.log('[Store] Detected games on system:', newDetectedGames.size);
      set({ detectedGames: newDetectedGames });

      // Cache detected games to localStorage
      try {
        const detectedGamesObj = Object.fromEntries(newDetectedGames);
        localStorage.setItem('lb-detected-games', JSON.stringify(detectedGamesObj));
      } catch (err) {
        console.error('[Store] Error caching detected games:', err);
      }
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
}));
