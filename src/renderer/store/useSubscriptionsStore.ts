import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Game } from '../../shared/types';

interface BaseNotification {
  id: string;
  type: 'status-change' | 'version-update' | 'app-update' | 'progress-change' | 'team-new-game' | 'team-status-change';
  gameName: string;
  timestamp: number;
}

export interface Notification extends BaseNotification {
  oldValue?: string;
  newValue?: string;
  gameId: string;
  teamName?: string;
  read: boolean;
}

export interface ToastNotification extends BaseNotification {
  message: string;
}

type GameProgress = Pick<
  Game,
  | 'translation_progress'
  | 'editing_progress'
  | 'voice_progress'
  | 'textures_progress'
  | 'fonts_progress'
>;

interface SubscriptionsStore {
  // Game Subscriptions
  subscribedGames: Set<string>;
  subscribedGameStatuses: Map<string, string>;
  subscribedGameProgress: Map<string, GameProgress>;

  // Team/Author Subscriptions
  subscribedTeams: Set<string>;

  notifications: Notification[];
  unreadCount: number;

  // Toast notifications (non-persisted, auto-dismiss)
  toasts: ToastNotification[];

  // Game Actions
  subscribe: (gameId: string, status: string, progress?: GameProgress) => void;
  unsubscribe: (gameId: string) => void;
  isSubscribed: (gameId: string) => boolean;
  getSubscribedStatus: (gameId: string) => string | undefined;
  getSubscribedProgress: (gameId: string) => GameProgress | undefined;
  updateSubscribedStatus: (gameId: string, status: string) => void;
  updateSubscribedProgress: (gameId: string, progress: GameProgress) => void;

  // Team Actions
  subscribeToTeam: (teamName: string) => void;
  unsubscribeFromTeam: (teamName: string) => void;
  isSubscribedToTeam: (teamName: string) => boolean;
  getSubscribedTeams: () => string[];
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
    showToast?: boolean
  ) => void;
  addVersionUpdateNotification: (
    gameId: string,
    gameName: string,
    oldVersion: string,
    newVersion: string,
    showToast?: boolean
  ) => void;
  addProgressChangeNotification: (
    gameId: string,
    gameName: string,
    progressType: string,
    oldValue: number,
    newValue: number,
    showToast?: boolean
  ) => void;
  addAppUpdateNotification: (
    oldVersion: string,
    newVersion: string,
    showToast?: boolean
  ) => void;
  addTeamNewGameNotification: (
    gameId: string,
    gameName: string,
    teamName: string,
    showToast?: boolean
  ) => void;
  addTeamStatusChangeNotification: (
    gameId: string,
    gameName: string,
    teamName: string,
    oldStatus: string,
    newStatus: string,
    showToast?: boolean
  ) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  dismissToast: (toastId: string) => void;
}

interface SerializedMap {
  __type: 'Map';
  data: [string, unknown][];
}

interface SerializedSet {
  __type: 'Set';
  data: string[];
}

type PersistedSubscriptionsState = Pick<
  SubscriptionsStore,
  | 'subscribedGames'
  | 'subscribedGameStatuses'
  | 'subscribedGameProgress'
  | 'subscribedTeams'
  | 'notifications'
  | 'unreadCount'
>;

// Custom storage with Map/Set serialization
const customStorage = createJSONStorage<PersistedSubscriptionsState>(() => localStorage, {
  reviver: (_key, value: unknown) => {
    if (value && typeof value === 'object' && '__type' in value) {
      const typed = value as SerializedMap | SerializedSet;
      if (typed.__type === 'Map') {
        return new Map(typed.data);
      }
      if (typed.__type === 'Set') {
        return new Set(typed.data);
      }
    }
    return value;
  },
  replacer: (_key, value: unknown) => {
    if (value instanceof Map) {
      return { __type: 'Map', data: Array.from(value.entries()) } as SerializedMap;
    }
    if (value instanceof Set) {
      return { __type: 'Set', data: Array.from(value) } as SerializedSet;
    }
    return value;
  },
});

const TOAST_DURATION = 8000; // 8 seconds

// Type guards
function isValidSet<T>(value: unknown): value is Set<T> {
  return value instanceof Set;
}

function isValidMap<K, V>(value: unknown): value is Map<K, V> {
  return value instanceof Map;
}

// Helper functions to safely get or create Set/Map instances
function ensureSet<T>(value: unknown): Set<T> {
  if (isValidSet<T>(value)) {
    return new Set(value);
  }
  console.warn('[SubscriptionsStore] Converting invalid Set to new Set');
  return new Set(Array.isArray(value) ? value : []);
}

function ensureMap<K, V>(value: unknown): Map<K, V> {
  if (isValidMap<K, V>(value)) {
    return new Map(value);
  }
  console.warn('[SubscriptionsStore] Converting invalid Map to new Map');
  // Handle both array format and object format
  if (Array.isArray(value)) {
    return new Map(value as [K, V][]);
  }
  if (value && typeof value === 'object') {
    return new Map(Object.entries(value) as [K, V][]);
  }
  return new Map();
}

// Migration helper
function migrateStoreData(state: Partial<SubscriptionsStore>): void {
  let migrated = false;

  if (!isValidSet(state.subscribedGames)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGames to Set');
    state.subscribedGames = ensureSet<string>(state.subscribedGames);
    migrated = true;
  }

  if (!isValidSet(state.subscribedTeams)) {
    console.warn('[SubscriptionsStore] Migrating subscribedTeams to Set');
    state.subscribedTeams = ensureSet<string>(state.subscribedTeams);
    migrated = true;
  }

  if (!isValidMap(state.subscribedGameStatuses)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGameStatuses to Map');
    state.subscribedGameStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
    migrated = true;
  }

  if (!isValidMap(state.subscribedGameProgress)) {
    console.warn('[SubscriptionsStore] Migrating subscribedGameProgress to Map');
    state.subscribedGameProgress = ensureMap<string, GameProgress>(state.subscribedGameProgress);
    migrated = true;
  }

  if (migrated) {
    console.log('[SubscriptionsStore] Migration completed', {
      subscribedGamesCount: state.subscribedGames?.size ?? 0,
      subscribedTeamsCount: state.subscribedTeams?.size ?? 0,
      subscribedGameStatusesCount: state.subscribedGameStatuses?.size ?? 0,
      subscribedGameProgressCount: state.subscribedGameProgress?.size ?? 0,
    });
  }
}

// Helper to track subscription via IPC (main process handles the API call)
async function trackSubscription(
  gameId: string,
  action: 'subscribe' | 'unsubscribe'
): Promise<void> {
  try {
    await window.electronAPI?.trackSubscription(gameId, action);
  } catch (error) {
    console.error('[Subscription] Failed to track subscription:', error);
  }
}

// Team subscriptions are stored locally only (no server tracking)
// This is intentional - we don't need server-side tracking for team subscriptions

// Helper to show system notification when window is hidden (in tray)
async function showSystemNotificationIfHidden(
  title: string,
  body: string
): Promise<void> {
  if (
    !window.windowControls?.isVisible ||
    !window.windowControls?.showSystemNotification
  ) {
    return;
  }

  try {
    const isVisible = await window.windowControls.isVisible();
    if (!isVisible) {
      await window.windowControls.showSystemNotification({ title, body });
    }
  } catch (error) {
    console.error('[Notification] Failed to show system notification:', error);
  }
}

export const useSubscriptionsStore = create<SubscriptionsStore>()(
  persist(
    (set, get) => ({
      subscribedGames: new Set<string>(),
      subscribedGameStatuses: new Map<string, string>(),
      subscribedGameProgress: new Map<string, GameProgress>(),
      subscribedTeams: new Set<string>(),
      notifications: [],
      unreadCount: 0,
      toasts: [],

      subscribe: (gameId, status, progress) => {
        set((state) => {
          const newSubscribed = ensureSet<string>(state.subscribedGames);
          newSubscribed.add(gameId);

          const newStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);

          const newProgress = ensureMap<string, GameProgress>(state.subscribedGameProgress);
          if (progress) {
            newProgress.set(gameId, progress);
          }

          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses, subscribedGameProgress: newProgress };
        });
        trackSubscription(gameId, 'subscribe');
      },

      unsubscribe: (gameId) => {
        set((state) => {
          const newSubscribed = ensureSet<string>(state.subscribedGames);
          newSubscribed.delete(gameId);

          const newStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
          newStatuses.delete(gameId);

          const newProgress = ensureMap<string, GameProgress>(state.subscribedGameProgress);
          newProgress.delete(gameId);

          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses, subscribedGameProgress: newProgress };
        });
        trackSubscription(gameId, 'unsubscribe');
      },

      isSubscribed: (gameId) => {
        const subscribedGames = get().subscribedGames;
        if (!isValidSet<string>(subscribedGames)) {
          console.error('[SubscriptionsStore] subscribedGames is not a Set');
          return false;
        }
        return subscribedGames.has(gameId);
      },

      getSubscribedStatus: (gameId) => {
        const subscribedGameStatuses = get().subscribedGameStatuses;
        if (!isValidMap<string, string>(subscribedGameStatuses)) {
          console.error('[SubscriptionsStore] subscribedGameStatuses is not a Map');
          return undefined;
        }
        return subscribedGameStatuses.get(gameId);
      },

      getSubscribedProgress: (gameId) => {
        const subscribedGameProgress = get().subscribedGameProgress;
        if (!isValidMap<string, GameProgress>(subscribedGameProgress)) {
          console.error('[SubscriptionsStore] subscribedGameProgress is not a Map');
          return undefined;
        }
        return subscribedGameProgress.get(gameId);
      },

      updateSubscribedStatus: (gameId, status) => {
        set((state) => {
          const newStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);
          return { subscribedGameStatuses: newStatuses };
        });
      },

      updateSubscribedProgress: (gameId, progress) => {
        set((state) => {
          const newProgress = ensureMap<string, GameProgress>(state.subscribedGameProgress);
          newProgress.set(gameId, progress);
          return { subscribedGameProgress: newProgress };
        });
      },

      // Team subscription methods (local only, no server tracking)
      subscribeToTeam: (teamName) => {
        set((state) => {
          const newSubscribedTeams = ensureSet<string>(state.subscribedTeams);
          newSubscribedTeams.add(teamName);
          return { subscribedTeams: newSubscribedTeams };
        });
        console.log(`[Subscription] Subscribed to team: ${teamName}`);
      },

      unsubscribeFromTeam: (teamName) => {
        set((state) => {
          const newSubscribedTeams = ensureSet<string>(state.subscribedTeams);
          newSubscribedTeams.delete(teamName);
          return { subscribedTeams: newSubscribedTeams };
        });
        console.log(`[Subscription] Unsubscribed from team: ${teamName}`);
      },

      isSubscribedToTeam: (teamName) => {
        const subscribedTeams = get().subscribedTeams;
        if (!isValidSet<string>(subscribedTeams)) {
          console.error('[SubscriptionsStore] subscribedTeams is not a Set');
          return false;
        }
        return subscribedTeams.has(teamName);
      },

      getSubscribedTeams: () => {
        const subscribedTeams = get().subscribedTeams;
        if (!isValidSet<string>(subscribedTeams)) {
          return [];
        }
        return Array.from(subscribedTeams);
      },

      addNotification: (notification, showToast = true) => {
        const id = `${notification.gameId}-${Date.now()}`;
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        // Show toast if enabled
        if (showToast) {
          const message = getNotificationMessage(notification);
          const toast: ToastNotification = {
            id,
            type: notification.type,
            gameName: notification.gameName,
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          // Auto-dismiss toast
          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          // Show system notification if window is hidden (in tray)
          showSystemNotificationIfHidden(notification.gameName, message);
        }
      },

      addVersionUpdateNotification: (
        gameId,
        gameName,
        oldVersion,
        newVersion,
        showToast = true
      ) => {
        const id = `${gameId}-version-${Date.now()}`;
        const newNotification: Notification = {
          id,
          type: 'version-update',
          gameId,
          gameName,
          oldValue: oldVersion,
          newValue: newVersion,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `Доступна версія ${newVersion}`;
          const toast: ToastNotification = {
            id,
            type: 'version-update',
            gameName,
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          // Show system notification if window is hidden (in tray)
          showSystemNotificationIfHidden(gameName, message);
        }
      },

      addProgressChangeNotification: (
        gameId,
        gameName,
        progressType,
        oldValue,
        newValue,
        showToast = true
      ) => {
        const id = `${gameId}-progress-${Date.now()}`;
        const newNotification: Notification = {
          id,
          type: 'progress-change',
          gameId,
          gameName,
          oldValue: `${progressType}: ${oldValue}%`,
          newValue: `${progressType}: ${newValue}%`,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `${progressType}: ${oldValue}% → ${newValue}%`;
          const toast: ToastNotification = {
            id,
            type: 'progress-change',
            gameName,
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          // Show system notification if window is hidden (in tray)
          showSystemNotificationIfHidden(gameName, message);
        }
      },

      addAppUpdateNotification: (oldVersion, newVersion, showToast = true) => {
        const id = `app-update-${Date.now()}`;
        const newNotification: Notification = {
          id,
          type: 'app-update',
          gameId: 'app',
          gameName: 'LB Launcher',
          oldValue: oldVersion,
          newValue: newVersion,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `Доступна версія ${newVersion}`;
          const toast: ToastNotification = {
            id,
            type: 'app-update',
            gameName: 'LB Launcher',
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          // Show system notification if window is hidden (in tray)
          showSystemNotificationIfHidden('LB Launcher', message);
        }
      },

      addTeamNewGameNotification: (
        gameId,
        gameName,
        teamName,
        showToast = true
      ) => {
        const id = `team-new-game-${gameId}-${Date.now()}`;
        const newNotification: Notification = {
          id,
          type: 'team-new-game',
          gameId,
          gameName,
          teamName,
          newValue: teamName,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `Нова локалізація від ${teamName}`;
          const toast: ToastNotification = {
            id,
            type: 'team-new-game',
            gameName,
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          showSystemNotificationIfHidden(gameName, message);
        }
      },

      addTeamStatusChangeNotification: (
        gameId,
        gameName,
        teamName,
        oldStatus,
        newStatus,
        showToast = true
      ) => {
        const id = `team-status-${gameId}-${Date.now()}`;
        const newNotification: Notification = {
          id,
          type: 'team-status-change',
          gameId,
          gameName,
          teamName,
          oldValue: oldStatus,
          newValue: newStatus,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `${teamName}: статус змінено на "${newStatus}"`;
          const toast: ToastNotification = {
            id,
            type: 'team-status-change',
            gameName,
            message,
            timestamp: Date.now(),
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          setTimeout(() => {
            get().dismissToast(id);
          }, TOAST_DURATION);

          showSystemNotificationIfHidden(gameName, message);
        }
      },

      markNotificationAsRead: (notificationId) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAllNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearNotification: (notificationId) => {
        set((state) => {
          const notifications = state.notifications.filter(
            (n) => n.id !== notificationId
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      clearAllNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      dismissToast: (toastId) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toastId),
        }));
      },
    }),
    {
      name: 'subscriptions-storage',
      storage: customStorage,
      partialize: (state) => ({
        subscribedGames: state.subscribedGames,
        subscribedGameStatuses: state.subscribedGameStatuses,
        subscribedGameProgress: state.subscribedGameProgress,
        subscribedTeams: state.subscribedTeams,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        // toasts are NOT persisted - they are temporary
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Initialize toasts as empty on rehydration
          state.toasts = [];

          // Migrate old data formats to new Set/Map structures
          migrateStoreData(state);

          console.log('[SubscriptionsStore] Store rehydrated successfully', {
            subscribedGamesCount: state.subscribedGames?.size ?? 0,
            subscribedTeamsCount: state.subscribedTeams?.size ?? 0,
            subscribedGameStatusesCount: state.subscribedGameStatuses?.size ?? 0,
            subscribedGameProgressCount: state.subscribedGameProgress?.size ?? 0,
            notificationsCount: state.notifications?.length ?? 0,
          });
        }
      },
    }
  )
);

// Helper function to generate notification message
function getNotificationMessage(
  notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
): string {
  switch (notification.type) {
    case 'status-change':
      return `Статус змінено на "${notification.newValue}"`;
    case 'version-update':
      return `Доступна версія ${notification.newValue}`;
    case 'app-update':
      return `Доступна версія ${notification.newValue}`;
    case 'progress-change':
      return `Прогрес оновлено: ${notification.newValue}`;
    case 'team-new-game':
      return `Нова локалізація від ${notification.teamName}`;
    case 'team-status-change':
      return `${notification.teamName}: статус змінено на "${notification.newValue}"`;
    default:
      return 'Нове сповіщення';
  }
}
