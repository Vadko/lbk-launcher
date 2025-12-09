import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notification {
  id: string;
  type: 'status-change' | 'version-update' | 'app-update';
  gameId: string;
  gameName: string;
  oldValue?: string;
  newValue?: string;
  timestamp: number;
  read: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'status-change' | 'version-update' | 'app-update';
  gameName: string;
  message: string;
  timestamp: number;
}

interface SubscriptionsStore {
  // Subscriptions
  subscribedGames: Set<string>;
  subscribedGameStatuses: Map<string, string>;
  notifications: Notification[];
  unreadCount: number;

  // Toast notifications (non-persisted, auto-dismiss)
  toasts: ToastNotification[];

  // Actions
  subscribe: (gameId: string, status: string) => void;
  unsubscribe: (gameId: string) => void;
  isSubscribed: (gameId: string) => boolean;
  getSubscribedStatus: (gameId: string) => string | undefined;
  updateSubscribedStatus: (gameId: string, status: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>, showToast?: boolean) => void;
  addVersionUpdateNotification: (gameId: string, gameName: string, oldVersion: string, newVersion: string, showToast?: boolean) => void;
  addAppUpdateNotification: (oldVersion: string, newVersion: string, showToast?: boolean) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  dismissToast: (toastId: string) => void;
}

const TOAST_DURATION = 8000; // 8 seconds

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
      notifications: [],
      unreadCount: 0,
      toasts: [],

      subscribe: (gameId, status) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.add(gameId);
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);
          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses };
        });
      },

      unsubscribe: (gameId) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.delete(gameId);
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.delete(gameId);
          return { subscribedGames: newSubscribed, subscribedGameStatuses: newStatuses };
        });
      },

      isSubscribed: (gameId) => {
        return get().subscribedGames.has(gameId);
      },

      getSubscribedStatus: (gameId) => {
        return get().subscribedGameStatuses.get(gameId);
      },

      updateSubscribedStatus: (gameId, status) => {
        set((state) => {
          const newStatuses = new Map(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);
          return { subscribedGameStatuses: newStatuses };
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
      partialize: (state) => ({
        subscribedGames: Array.from(state.subscribedGames),
        subscribedGameStatuses: Array.from(state.subscribedGameStatuses.entries()),
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        // toasts are NOT persisted - they are temporary
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.subscribedGames) {
            state.subscribedGames = new Set(state.subscribedGames as any);
          }
          if (state.subscribedGameStatuses) {
            state.subscribedGameStatuses = new Map(state.subscribedGameStatuses as any);
          } else {
            state.subscribedGameStatuses = new Map();
          }
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
    default:
      return 'Нове сповіщення';
  }
}
