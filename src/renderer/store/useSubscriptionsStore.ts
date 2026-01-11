import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Notification,
  ToastNotification,
  GameProgress,
  PersistedSubscriptionsState,
} from './subscriptions/types';
import {
  getNotificationMessage,
  createNotification,
  createToast,
  showSystemNotificationIfHidden,
  scheduleToastDismissal,
  trackSubscription,
  playNotificationSoundIfEnabled,
} from './subscriptions/notificationHelpers';
import {
  customStorage,
  isValidSet,
  isValidMap,
  ensureSet,
  ensureMap,
  migrateStoreData,
} from './subscriptions/storageHelpers';

// Re-export types for external use
export type {
  Notification,
  ToastNotification,
  GameProgress,
} from './subscriptions/types';

interface SubscriptionsStore extends PersistedSubscriptionsState {
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

  // Prompted Games Actions
  markGameAsPrompted: (gameId: string) => void;
  isGamePrompted: (gameId: string) => boolean;

  // Version notification tracking
  hasNotifiedVersion: (gameId: string, version: string) => boolean;
  clearNotifiedVersion: (gameId: string) => void;

  // Notification Actions
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

export const useSubscriptionsStore = create<SubscriptionsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      subscribedGames: new Set<string>(),
      subscribedGameStatuses: new Map<string, string>(),
      subscribedGameProgress: new Map<string, GameProgress>(),
      subscribedTeams: new Set<string>(),
      promptedGamesForSubscription: new Set<string>(),
      notifications: [],
      unreadCount: 0,
      toasts: [],
      notifiedVersions: new Map<string, string>(),

      // Game subscription methods
      subscribe: (gameId, status, progress) => {
        set((state) => {
          const newSubscribed = ensureSet<string>(state.subscribedGames);
          newSubscribed.add(gameId);

          const newStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
          newStatuses.set(gameId, status);

          const newProgress = ensureMap<string, GameProgress>(
            state.subscribedGameProgress
          );
          if (progress) {
            newProgress.set(gameId, progress);
          }

          return {
            subscribedGames: newSubscribed,
            subscribedGameStatuses: newStatuses,
            subscribedGameProgress: newProgress,
          };
        });
        trackSubscription(gameId, 'subscribe');
      },

      unsubscribe: (gameId) => {
        set((state) => {
          const newSubscribed = ensureSet<string>(state.subscribedGames);
          newSubscribed.delete(gameId);

          const newStatuses = ensureMap<string, string>(state.subscribedGameStatuses);
          newStatuses.delete(gameId);

          const newProgress = ensureMap<string, GameProgress>(
            state.subscribedGameProgress
          );
          newProgress.delete(gameId);

          return {
            subscribedGames: newSubscribed,
            subscribedGameStatuses: newStatuses,
            subscribedGameProgress: newProgress,
          };
        });
        trackSubscription(gameId, 'unsubscribe');
      },

      isSubscribed: (gameId) => {
        const { subscribedGames } = get();
        return isValidSet<string>(subscribedGames) && subscribedGames.has(gameId);
      },

      getSubscribedStatus: (gameId) => {
        const { subscribedGameStatuses } = get();
        return isValidMap<string, string>(subscribedGameStatuses)
          ? subscribedGameStatuses.get(gameId)
          : undefined;
      },

      getSubscribedProgress: (gameId) => {
        const { subscribedGameProgress } = get();
        return isValidMap<string, GameProgress>(subscribedGameProgress)
          ? subscribedGameProgress.get(gameId)
          : undefined;
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
          const newProgress = ensureMap<string, GameProgress>(
            state.subscribedGameProgress
          );
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
        const { subscribedTeams } = get();
        return isValidSet<string>(subscribedTeams) && subscribedTeams.has(teamName);
      },

      getSubscribedTeams: () => {
        const { subscribedTeams } = get();
        return isValidSet<string>(subscribedTeams) ? Array.from(subscribedTeams) : [];
      },

      // Prompted games methods (for author subscription modal)
      markGameAsPrompted: (gameId) => {
        set((state) => {
          const newPromptedGames = ensureSet<string>(state.promptedGamesForSubscription);
          newPromptedGames.add(gameId);
          return { promptedGamesForSubscription: newPromptedGames };
        });
        console.log(`[Subscription] Marked game as prompted: ${gameId}`);
      },

      isGamePrompted: (gameId) => {
        const { promptedGamesForSubscription } = get();
        return (
          isValidSet<string>(promptedGamesForSubscription) &&
          promptedGamesForSubscription.has(gameId)
        );
      },

      // Version notification tracking methods
      hasNotifiedVersion: (gameId, version) => {
        const { notifiedVersions } = get();
        return (
          isValidMap<string, string>(notifiedVersions) &&
          notifiedVersions.get(gameId) === version
        );
      },

      clearNotifiedVersion: (gameId) => {
        set((state) => {
          const newNotifiedVersions = ensureMap<string, string>(state.notifiedVersions);
          newNotifiedVersions.delete(gameId);
          return { notifiedVersions: newNotifiedVersions };
        });
      },

      // Notification methods
      addNotification: (notificationParams, showToast = true) => {
        const notification = createNotification(notificationParams);

        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = getNotificationMessage(notificationParams);
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled(notificationParams.type);
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden(
            notificationParams.gameName,
            message,
            notificationParams.gameId
          );
        }
      },

      addVersionUpdateNotification: (
        gameId,
        gameName,
        oldVersion,
        newVersion,
        showToast = true
      ) => {
        const notification = createNotification({
          type: 'version-update',
          gameId,
          gameName,
          oldValue: oldVersion,
          newValue: newVersion,
          idPrefix: `${gameId}-version`,
        });

        set((state) => {
          // Track that we've notified about this version
          const newNotifiedVersions = ensureMap<string, string>(state.notifiedVersions);
          newNotifiedVersions.set(gameId, newVersion);

          return {
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
            notifiedVersions: newNotifiedVersions,
          };
        });

        if (showToast) {
          const message = `Доступна версія ${newVersion}`;
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled('version-update');
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden(gameName, message, gameId);
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
        const notification = createNotification({
          type: 'progress-change',
          gameId,
          gameName,
          oldValue: `${progressType}: ${oldValue}%`,
          newValue: `${progressType}: ${newValue}%`,
          idPrefix: `${gameId}-progress`,
        });

        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `${progressType}: ${oldValue}% → ${newValue}%`;
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled('progress-change');
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden(gameName, message, gameId);
        }
      },

      addAppUpdateNotification: (oldVersion, newVersion, showToast = true) => {
        const notification = createNotification({
          type: 'app-update',
          gameId: 'app',
          gameName: 'LBK Launcher',
          oldValue: oldVersion,
          newValue: newVersion,
          idPrefix: 'app-update',
        });

        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `Доступна версія ${newVersion}`;
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled('app-update');
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden('LBK Launcher', message);
        }
      },

      addTeamNewGameNotification: (gameId, gameName, teamName, showToast = true) => {
        const notification = createNotification({
          type: 'team-new-game',
          gameId,
          gameName,
          teamName,
          newValue: teamName,
          idPrefix: `team-new-game-${gameId}`,
        });

        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `Нова локалізація від ${teamName}`;
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled('team-new-game');
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden(gameName, message, gameId);
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
        const notification = createNotification({
          type: 'team-status-change',
          gameId,
          gameName,
          teamName,
          oldValue: oldStatus,
          newValue: newStatus,
          idPrefix: `team-status-${gameId}`,
        });

        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        if (showToast) {
          const message = `${teamName}: стан змінено на "${newStatus}"`;
          const toast = createToast(notification, message);

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          playNotificationSoundIfEnabled('team-status-change');
          scheduleToastDismissal(notification.id, get().dismissToast);
          showSystemNotificationIfHidden(gameName, message, gameId);
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
        promptedGamesForSubscription: state.promptedGamesForSubscription,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        notifiedVersions: state.notifiedVersions,
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
            promptedGamesCount: state.promptedGamesForSubscription?.size ?? 0,
            subscribedGameStatusesCount: state.subscribedGameStatuses?.size ?? 0,
            subscribedGameProgressCount: state.subscribedGameProgress?.size ?? 0,
            notificationsCount: state.notifications?.length ?? 0,
          });
        }
      },
    }
  )
);
