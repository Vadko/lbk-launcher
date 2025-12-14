import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Game } from '../../shared/types';

interface BaseNotification {
  id: string;
  type: 'status-change' | 'version-update' | 'app-update' | 'progress-change';
  gameName: string;
  timestamp: number;
}

export interface Notification extends BaseNotification {
  oldValue?: string;
  newValue?: string;
  gameId: string;
  read: boolean;
}

export interface ToastNotification extends BaseNotification {
  message: string;
}

export type GameProgress = Pick<Game,
  | 'translation_progress'
  | 'editing_progress'
  | 'voice_progress'
  | 'textures_progress'
  | 'fonts_progress'
>;

interface SubscriptionsStore {
  // Subscriptions
  subscribedGames: Set<string>;
  subscribedGameStatuses: Map<string, string>;
  subscribedGameProgress: Map<string, GameProgress>;
  notifications: Notification[];
  unreadCount: number;

  // Toast notifications (non-persisted, auto-dismiss)
  toasts: ToastNotification[];

  // Actions
  subscribe: (gameId: string, status: string, progress?: GameProgress) => void;
  unsubscribe: (gameId: string) => void;
  isSubscribed: (gameId: string) => boolean;
  getSubscribedStatus: (gameId: string) => string | undefined;
  getSubscribedProgress: (gameId: string) => GameProgress | undefined;
  updateSubscribedStatus: (gameId: string, status: string) => void;
  updateSubscribedProgress: (gameId: string, progress: GameProgress) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>, showToast?: boolean) => void;
  addVersionUpdateNotification: (gameId: string, gameName: string, oldVersion: string, newVersion: string, showToast?: boolean) => void;
  addProgressChangeNotification: (gameId: string, gameName: string, progressType: string, oldValue: number, newValue: number, showToast?: boolean) => void;
  addAppUpdateNotification: (oldVersion: string, newVersion: string, showToast?: boolean) => void;
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

type PersistedSubscriptionsState = Pick<SubscriptionsStore,
  | 'subscribedGames'
  | 'subscribedGameStatuses'
  | 'subscribedGameProgress'
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

// Helper to track subscription via IPC (main process handles the API call)
async function trackSubscription(gameId: string, action: 'subscribe' | 'unsubscribe'): Promise<void> {
  try {
    await window.electronAPI?.trackSubscription(gameId, action);
  } catch (error) {
    console.error('[Subscription] Failed to track subscription:', error);
  }
}

// Helper to show system notification when window is hidden (in tray)
async function showSystemNotificationIfHidden(title: string, body: string): Promise<void> {
  if (!window.windowControls?.isVisible || !window.windowControls?.showSystemNotification) {
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
      notifications: [],
      unreadCount: 0,
      toasts: [],

      subscribe: (gameId, status, progress) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.add(gameId);
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);
          const newProgress = new Map(state.subscribedGameProgress);
          if (progress) {
            newProgress.set(gameId, progress);
          }
          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses, subscribedGameProgress: newProgress };
        });
        // Track subscription via API (non-blocking)
        trackSubscription(gameId, 'subscribe');
      },

      unsubscribe: (gameId) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.delete(gameId);
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.delete(gameId);
          const newProgress = new Map(state.subscribedGameProgress);
          newProgress.delete(gameId);
          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses, subscribedGameProgress: newProgress };
        });
        // Track unsubscription via API (non-blocking)
        trackSubscription(gameId, 'unsubscribe');
      },

      isSubscribed: (gameId) => {
        return get().subscribedGames.has(gameId);
      },

      getSubscribedStatus: (gameId) => {
        return get().subscribedGameStatuses.get(gameId);
      },

      getSubscribedProgress: (gameId) => {
        return get().subscribedGameProgress.get(gameId);
      },

      updateSubscribedStatus: (gameId, status) => {
        set((state) => {
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);
          return { subscribedGameStatuses: newStatuses };
        });
      },

      updateSubscribedProgress: (gameId, progress) => {
        set((state) => {
          const newProgress = new Map(state.subscribedGameProgress);
          newProgress.set(gameId, progress);
          return { subscribedGameProgress: newProgress };
        });
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

      addVersionUpdateNotification: (gameId, gameName, oldVersion, newVersion, showToast = true) => {
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

      addProgressChangeNotification: (gameId, gameName, progressType, oldValue, newValue, showToast = true) => {
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
          const notifications = state.notifications.filter((n) => n.id !== notificationId);
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
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        // toasts are NOT persisted - they are temporary
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Initialize toasts as empty on rehydration
          state.toasts = [];
        }
      },
    }
  )
);

// Helper function to generate notification message
function getNotificationMessage(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): string {
  switch (notification.type) {
    case 'status-change':
      return `Статус змінено на "${notification.newValue}"`;
    case 'version-update':
      return `Доступна версія ${notification.newValue}`;
    case 'app-update':
      return `Доступна версія ${notification.newValue}`;
    case 'progress-change':
      return `Прогрес оновлено: ${notification.newValue}`;
    default:
      return 'Нове сповіщення';
  }
}
