import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Notification {
  id: string;
  type: 'status-change' | 'version-update';
  gameId: string;
  gameName: string;
  oldValue?: string; // Старий статус або версія
  newValue?: string; // Новий статус або версія
  timestamp: number;
  read: boolean;
}

interface SubscriptionsStore {
  // Subscriptions
  subscribedGames: Set<string>; // Game IDs the user is subscribed to
  notifications: Notification[];
  unreadCount: number;

  // Actions
  subscribe: (gameId: string) => void;
  unsubscribe: (gameId: string) => void;
  isSubscribed: (gameId: string) => boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addVersionUpdateNotification: (gameId: string, gameName: string, oldVersion: string, newVersion: string) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  getUnreadCount: () => number;
}

export const useSubscriptionsStore = create<SubscriptionsStore>()(
  persist(
    (set, get) => ({
      subscribedGames: new Set<string>(),
      notifications: [],
      unreadCount: 0,

      subscribe: (gameId) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.add(gameId);
          return { subscribedGames: newSubscribed };
        });
      },

      unsubscribe: (gameId) => {
        set((state) => {
          const newSubscribed = new Set(state.subscribedGames);
          newSubscribed.delete(gameId);
          return { subscribedGames: newSubscribed };
        });
      },

      isSubscribed: (gameId) => {
        return get().subscribedGames.has(gameId);
      },

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `${notification.gameId}-${Date.now()}`,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },

      addVersionUpdateNotification: (gameId, gameName, oldVersion, newVersion) => {
        const newNotification: Notification = {
          id: `${gameId}-version-${Date.now()}`,
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

      getUnreadCount: () => {
        return get().unreadCount;
      },
    }),
    {
      name: 'subscriptions-storage',
      partialize: (state) => ({
        subscribedGames: Array.from(state.subscribedGames),
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.subscribedGames) {
          // Convert array back to Set after hydration
          state.subscribedGames = new Set(state.subscribedGames as any);
        }
      },
    }
  )
);