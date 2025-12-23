import { create } from 'zustand';
import type { Game } from '../types/game';
import type {
  DownloadProgress,
  InstallationInfo,
  DetectedGameInfo,
} from '../../shared/types';
import { useSubscriptionsStore } from './useSubscriptionsStore';
import { useSettingsStore } from './useSettingsStore';

interface InstallationProgress {
  isInstalling: boolean;
  isUninstalling: boolean;
  isPaused: boolean;
  progress: number;
  downloadProgress: DownloadProgress | null;
  statusMessage: string | null;
}

interface Store {
  // UI State
  selectedGame: Game | null;
  selectedStatuses: string[];
  searchQuery: string;
  isInitialLoad: boolean;

  // Steam State
  steamGames: Map<string, string>; // installdir (lowercase) -> full path

  // Installation State
  installedGames: Map<string, InstallationInfo>; // Metadata про встановлені українізатори
  detectedGames: Map<string, DetectedGameInfo>; // Ігри знайдені на системі
  gamesWithUpdates: Set<string>; // Ігри з доступними оновленнями
  installationProgress: Map<string, InstallationProgress>;
  isCheckingInstallation: Map<string, boolean>;

  // UI Actions
  setSelectedGame: (game: Game | null) => void;
  setSelectedStatuses: (statuses: string[]) => void;
  setSearchQuery: (query: string) => void;
  setInitialLoadComplete: () => void;

  // Steam Actions
  loadSteamGames: () => Promise<void>;
  clearSteamGamesCache: () => void;

  // Installation Actions
  loadInstalledGamesFromSystem: () => Promise<void>;
  clearInstalledGamesCache: () => void;
  checkInstallationStatus: (gameId: string, game: Game) => Promise<void>;
  clearGameUpdate: (gameId: string) => void;
  setInstallationProgress: (
    gameId: string,
    progress: Partial<InstallationProgress>
  ) => void;
  clearInstallationProgress: (gameId: string) => void;
  getInstallationProgress: (gameId: string) => InstallationProgress | undefined;
  getInstallationInfo: (gameId: string) => InstallationInfo | undefined;
  isCheckingInstallationStatus: (gameId: string) => boolean;

  // Game Detection Actions
  clearDetectedGamesCache: () => void;
  detectInstalledGames: (games: Game[]) => Promise<void>;
  isGameDetected: (gameId: string) => boolean;

  // Subscription Status Check
  checkSubscribedGamesStatus: (games: Game[]) => void;
  checkSubscribedTeamUpdate: (updatedGame: Game, oldGame: Game | null) => void;
}

// detectedGames більше не персіститься - має перевірятися при кожному запуску
// бо користувач може встановити/видалити ігри через Steam/GOG/Epic

export const useStore = create<Store>((set, get) => ({
  // UI State
  selectedGame: null,
  selectedStatuses: [],
  searchQuery: '',
  isInitialLoad: true,

  // Steam State
  steamGames: new Map(),

  // Installation State
  installedGames: new Map(),
  detectedGames: new Map(), // Більше не кешується в localStorage
  gamesWithUpdates: new Set(),
  installationProgress: new Map(),
  isCheckingInstallation: new Map(),

  // UI Actions
  setSelectedGame: (game) => set({ selectedGame: game }),

  setSelectedStatuses: (selectedStatuses) => set({ selectedStatuses }),

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
  loadInstalledGamesFromSystem: async () => {
    if (!window.electronAPI) return;

    console.log('[Store] Loading installed translations from installation-cache');

    try {
      // 1. Отримати ID всіх ігор з встановленими українізаторами з installation-cache/
      const installedGameIds = await window.electronAPI.getAllInstalledGameIds();
      console.log(
        `[Store] Found ${installedGameIds.length} games with installed translations`
      );

      if (installedGameIds.length === 0) {
        console.log('[Store] No installed translations found');
        set({
          installedGames: new Map(),
          gamesWithUpdates: new Set(),
        });
        return;
      }

      // 2. Отримати інфо про ці ігри з бази даних
      const installedGames = await window.electronAPI.fetchGamesByIds(installedGameIds);
      console.log(`[Store] Fetched ${installedGames.length} game records from database`);

      // 3. Перевірити installation info для кожної гри (паралельно)
      const checkResults = await Promise.all(
        installedGames.map(async (game) => {
          const installInfo = await window.electronAPI.checkInstallation(game);
          return { game, installInfo };
        })
      );

      // Create fresh maps (not copying from old state to properly handle deletions)
      const installedGamesMap = new Map<string, InstallationInfo>();
      const gamesWithUpdatesSet = new Set<string>();

      // Обробляємо результати
      const orphanedGameIds: string[] = []; // Ігри які вже не існують на диску

      for (const { game, installInfo } of checkResults) {
        if (installInfo) {
          installedGamesMap.set(game.id, installInfo);

          // Check if installed version differs from current version in DB
          if (game.version && installInfo.version !== game.version) {
            gamesWithUpdatesSet.add(game.id);

            // Додати нотифікацію в store (з перевіркою налаштувань та дублікатів)
            const { gameUpdateNotificationsEnabled } = useSettingsStore.getState();
            const { notifications, addVersionUpdateNotification } =
              useSubscriptionsStore.getState();

            if (gameUpdateNotificationsEnabled) {
              // Перевірити чи вже є така нотифікація
              const hasExistingNotification = notifications.some(
                (n) =>
                  n.type === 'version-update' &&
                  n.gameId === game.id &&
                  n.newValue === game.version
              );

              if (!hasExistingNotification) {
                addVersionUpdateNotification(
                  game.id,
                  game.name,
                  installInfo.version,
                  game.version
                );
              }
            }
          }
        } else {
          // Гра була встановлена раніше але зараз не існує (видалена через Steam/GOG/Epic)
          // Треба видалити метадані з installation-cache/
          orphanedGameIds.push(game.id);
          console.log(
            `[Store] Game ${game.name} no longer exists on disk, will clean up metadata`
          );
        }
      }

      // Видалити orphaned метадані
      if (orphanedGameIds.length > 0) {
        console.log(
          `[Store] Cleaning up ${orphanedGameIds.length} orphaned game metadata`
        );
        await window.electronAPI.removeOrphanedMetadata(orphanedGameIds);
      }

      set({
        installedGames: installedGamesMap,
        gamesWithUpdates: gamesWithUpdatesSet,
      });

      console.log(`[Store] Loaded ${installedGamesMap.size} installed translations`);
    } catch (error) {
      console.error('[Store] Error loading installed translations:', error);
    }
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
        isPaused: false,
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

  getInstallationProgress: (gameId: string) => get().installationProgress.get(gameId),

  getInstallationInfo: (gameId: string) => get().installedGames.get(gameId),

  isCheckingInstallationStatus: (gameId: string) => get().isCheckingInstallation.get(gameId) || false,

  // Game Detection Actions
  clearDetectedGamesCache: () => {
    console.log('[Store] Clearing detected games cache');
    set({ detectedGames: new Map() });
  },

  detectInstalledGames: async (games: Game[]) => {
    if (!window.electronAPI) return;

    try {
      const state = get();
      const newDetectedGames = new Map(state.detectedGames); // Мержимо з існуючими
      const steamGames = state.steamGames;

      console.log(
        `[Store] Detecting ${games.length} games using cached Steam data (${steamGames.size} Steam games)`
      );

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
    } catch (error) {
      console.error('[Store] Error detecting games:', error);
    }
  },

  isGameDetected: (gameId: string) => get().detectedGames.has(gameId),

  // Check subscribed games for status and progress changes on app startup
  checkSubscribedGamesStatus: (games: Game[]) => {
    const {
      subscribedGames,
      getSubscribedStatus,
      getSubscribedProgress,
      updateSubscribedStatus,
      updateSubscribedProgress,
      addNotification,
      addProgressChangeNotification,
      notifications,
    } = useSubscriptionsStore.getState();

    // Create a map of games for quick lookup
    const gamesMap = new Map(games.map((g) => [g.id, g]));

    // Progress type labels
    const progressLabels: Record<string, string> = {
      translation_progress: 'Переклад',
      editing_progress: 'Редактура',
      voice_progress: 'Озвучення',
      textures_progress: 'Текстури',
      fonts_progress: 'Шрифти',
    };

    // Check each subscribed game
    subscribedGames.forEach((gameId) => {
      const game = gamesMap.get(gameId);
      if (!game) return;

      const savedStatus = getSubscribedStatus(gameId);
      const savedProgress = getSubscribedProgress(gameId);

      // Check status change (from planned to something else)
      if (savedStatus === 'planned' && game.status !== 'planned') {
        const statusText =
          game.status === 'completed'
            ? 'Завершено'
            : game.status === 'in-progress'
              ? 'Ранній доступ'
              : game.status;

        const hasExistingNotification = notifications.some(
          (n) =>
            n.type === 'status-change' && n.gameId === gameId && n.newValue === statusText
        );

        if (!hasExistingNotification) {
          console.log(
            `[Store] Status changed for subscribed game ${game.name}: ${savedStatus} -> ${game.status}`
          );

          addNotification({
            type: 'status-change',
            gameId: game.id,
            gameName: game.name,
            oldValue: 'Заплановано',
            newValue: statusText,
          });
        }

        // Unsubscribe since the game is no longer planned
        useSubscriptionsStore.getState().unsubscribe(gameId);
        console.log(
          `[Store] Auto-unsubscribed from ${game.name} (status changed from planned)`
        );
        return; // Skip progress check since we unsubscribed
      } if (!savedStatus) {
        updateSubscribedStatus(gameId, game.status);
      }

      // Check progress changes
      const currentProgress = {
        translation_progress: game.translation_progress,
        editing_progress: game.editing_progress,
        voice_progress: game.voice_progress,
        textures_progress: game.textures_progress,
        fonts_progress: game.fonts_progress,
      };

      if (savedProgress) {
        // Check each progress type for changes
        (Object.keys(progressLabels) as Array<keyof typeof currentProgress>).forEach(
          (key) => {
            const oldVal = savedProgress[key];
            const newVal = currentProgress[key];

            // Only notify if both values are numbers and new value is higher
            if (
              typeof oldVal === 'number' &&
              typeof newVal === 'number' &&
              newVal > oldVal
            ) {
              console.log(
                `[Store] Progress changed for ${game.name}: ${key} ${oldVal}% -> ${newVal}%`
              );

              addProgressChangeNotification(
                game.id,
                game.name,
                progressLabels[key],
                oldVal,
                newVal
              );
            }
          }
        );
      }

      // Update saved progress
      updateSubscribedProgress(gameId, currentProgress);
    });
  },

  // Check if updated game triggers team subscription notifications
  checkSubscribedTeamUpdate: (updatedGame: Game, oldGame: Game | null) => {
    const {
      isSubscribedToTeam,
      subscribedGames,
      addTeamNewGameNotification,
      addTeamStatusChangeNotification,
      notifications,
    } = useSubscriptionsStore.getState();

    if (!updatedGame.team || !isSubscribedToTeam(updatedGame.team)) return;

    // Skip if user is also subscribed to this specific game (to avoid duplicate notifications)
    const isAlsoSubscribedToGame = subscribedGames.has(updatedGame.id);

    const statusLabels: Record<string, string> = {
      planned: 'Заплановано',
      'in-progress': 'Ранній доступ',
      completed: 'Завершено',
    };

    if (oldGame) {
      // Existing game - check for status change from "planned"
      // Skip if user is subscribed to the game itself (checkSubscribedGamesStatus handles it)
      if (
        !isAlsoSubscribedToGame &&
        oldGame.status === 'planned' &&
        updatedGame.status !== 'planned'
      ) {
        const oldStatusText = statusLabels[oldGame.status] || oldGame.status;
        const newStatusText = statusLabels[updatedGame.status] || updatedGame.status;

        const hasExisting = notifications.some(
          (n) =>
            n.type === 'team-status-change' &&
            n.gameId === updatedGame.id &&
            n.newValue === updatedGame.status
        );

        if (!hasExisting) {
          console.log(
            `[Store] Status change for subscribed team "${updatedGame.team}": ${updatedGame.name} is now ${newStatusText}`
          );
          addTeamStatusChangeNotification(
            updatedGame.id,
            updatedGame.name,
            updatedGame.team,
            oldStatusText,
            newStatusText
          );
        }
      }
    } else {
      // New game from subscribed team
      const hasExisting = notifications.some(
        (n) => n.type === 'team-new-game' && n.gameId === updatedGame.id
      );

      if (!hasExisting) {
        console.log(
          `[Store] New game from subscribed team "${updatedGame.team}": ${updatedGame.name}`
        );
        addTeamNewGameNotification(updatedGame.id, updatedGame.name, updatedGame.team);
      }
    }
  },
}));
