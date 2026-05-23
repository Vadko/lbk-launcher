import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SortOrderType } from '../../shared/types';
import type { SpecialFilterType } from '../components/Sidebar/types';
import { electronStorage } from './electronStorage';
import { useSubscriptionsStore } from './useSubscriptionsStore';

interface SettingsStore {
  sortOrder: SortOrderType;
  animationsEnabled: boolean;
  appUpdateNotificationsEnabled: boolean;
  gameUpdateNotificationsEnabled: boolean;
  createBackupBeforeInstall: boolean;
  autoDetectInstalledGames: boolean;
  showAdultGames: boolean;
  hideAiTranslations: boolean;
  liquidGlassEnabled: boolean;
  gamepadSoundsEnabled: boolean;
  isSettingsModalOpen: boolean;
  sidebarWidth: number;
  specialFilter: SpecialFilterType | null;
  selectedAuthors: string[];
  favoriteGameIds: string[];
  notificationSoundsEnabled: boolean;
  setSortOrder: (order: SortOrderType) => void;
  toggleNotificationSounds: () => void;
  setSpecialFilter: (filter: SpecialFilterType | null) => void;
  setSelectedAuthors: (authors: string[]) => void;
  toggleFavoriteGame: (gameId: string, gameName: string) => void;
  isFavoriteGame: (gameId: string) => boolean;
  toggleAnimations: () => void;
  toggleAppUpdateNotifications: () => void;
  toggleGameUpdateNotifications: () => void;
  toggleCreateBackup: () => void;
  toggleAutoDetectInstalledGames: () => void;
  toggleShowAdultGames: () => void;
  toggleHideAiTranslations: () => void;
  toggleLiquidGlass: () => void;
  toggleGamepadSounds: () => void;
  setSidebarWidth: (width: number) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      sortOrder: 'name',
      animationsEnabled: true,
      appUpdateNotificationsEnabled: true,
      gameUpdateNotificationsEnabled: true,
      createBackupBeforeInstall: true,
      autoDetectInstalledGames: true,
      showAdultGames: false,
      hideAiTranslations: false,
      liquidGlassEnabled: true,
      gamepadSoundsEnabled: true,
      isSettingsModalOpen: false,
      sidebarWidth: 320,
      specialFilter: null,
      selectedAuthors: [],
      favoriteGameIds: [],
      notificationSoundsEnabled: true,
      setSortOrder: (sortOrder) => set({ sortOrder }),

      toggleNotificationSounds: () =>
        set((state) => ({ notificationSoundsEnabled: !state.notificationSoundsEnabled })),

      setSpecialFilter: (specialFilter) => set({ specialFilter }),

      setSelectedAuthors: (selectedAuthors) => set({ selectedAuthors }),

      toggleFavoriteGame: (gameId, gameName) => {
        const state = get();
        const isCurrentlyFavorite = state.favoriteGameIds.includes(gameId);
        const isFirstFavorite =
          state.favoriteGameIds.length === 0 && !isCurrentlyFavorite;

        set({
          favoriteGameIds: isCurrentlyFavorite
            ? state.favoriteGameIds.filter((id) => id !== gameId)
            : [...state.favoriteGameIds, gameId],
        });

        // Show notification if this is the first favorite being added
        if (isFirstFavorite) {
          useSubscriptionsStore
            .getState()
            .addFirstFavoriteNotification(gameId, gameName, true);
        }
      },

      isFavoriteGame: (gameId) => get().favoriteGameIds.includes(gameId),

      toggleAnimations: () =>
        set((state) => ({ animationsEnabled: !state.animationsEnabled })),

      toggleAppUpdateNotifications: () =>
        set((state) => ({
          appUpdateNotificationsEnabled: !state.appUpdateNotificationsEnabled,
        })),

      toggleGameUpdateNotifications: () =>
        set((state) => ({
          gameUpdateNotificationsEnabled: !state.gameUpdateNotificationsEnabled,
        })),

      toggleCreateBackup: () =>
        set((state) => ({ createBackupBeforeInstall: !state.createBackupBeforeInstall })),

      toggleAutoDetectInstalledGames: () =>
        set((state) => ({ autoDetectInstalledGames: !state.autoDetectInstalledGames })),

      toggleShowAdultGames: () =>
        set((state) => ({ showAdultGames: !state.showAdultGames })),

      toggleHideAiTranslations: () =>
        set((state) => ({ hideAiTranslations: !state.hideAiTranslations })),

      toggleLiquidGlass: () =>
        set((state) => ({ liquidGlassEnabled: !state.liquidGlassEnabled })),

      toggleGamepadSounds: () =>
        set((state) => ({ gamepadSoundsEnabled: !state.gamepadSoundsEnabled })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),

      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    }),
    {
      name: 'lbk-settings',
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({
        sortOrder: state.sortOrder,
        animationsEnabled: state.animationsEnabled,
        appUpdateNotificationsEnabled: state.appUpdateNotificationsEnabled,
        gameUpdateNotificationsEnabled: state.gameUpdateNotificationsEnabled,
        createBackupBeforeInstall: state.createBackupBeforeInstall,
        autoDetectInstalledGames: state.autoDetectInstalledGames,
        showAdultGames: state.showAdultGames,
        hideAiTranslations: state.hideAiTranslations,
        liquidGlassEnabled: state.liquidGlassEnabled,
        gamepadSoundsEnabled: state.gamepadSoundsEnabled,
        sidebarWidth: state.sidebarWidth,
        specialFilter: state.specialFilter,
        selectedAuthors: state.selectedAuthors,
        favoriteGameIds: state.favoriteGameIds,
        notificationSoundsEnabled: state.notificationSoundsEnabled,
      }),
    }
  )
);
