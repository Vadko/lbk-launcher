import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecialFilterType, SortOrderType } from '../components/Sidebar/types';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsStore {
  theme: ThemeMode;
  sortOrder: SortOrderType;
  animationsEnabled: boolean;
  appUpdateNotificationsEnabled: boolean;
  gameUpdateNotificationsEnabled: boolean;
  createBackupBeforeInstall: boolean;
  autoDetectInstalledGames: boolean;
  showAdultGames: boolean;
  showAiTranslations: boolean;
  liquidGlassEnabled: boolean;
  gamepadSoundsEnabled: boolean;
  isSettingsModalOpen: boolean;
  saveLogsToFile: boolean;
  sidebarWidth: number;
  specialFilter: SpecialFilterType | null;
  selectedAuthors: string[];
  notificationSoundsEnabled: boolean;
  alphabetSidebarEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setSortOrder: (order: SortOrderType) => void;
  toggleNotificationSounds: () => void;
  setSpecialFilter: (filter: SpecialFilterType | null) => void;
  setSelectedAuthors: (authors: string[]) => void;
  toggleAnimations: () => void;
  toggleAppUpdateNotifications: () => void;
  toggleGameUpdateNotifications: () => void;
  toggleCreateBackup: () => void;
  toggleAutoDetectInstalledGames: () => void;
  toggleShowAdultGames: () => void;
  toggleShowAiTranslations: () => void;
  toggleLiquidGlass: () => void;
  toggleGamepadSounds: () => void;
  toggleSaveLogsToFile: () => void;
  toggleAlphabetSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sortOrder: 'name',
      animationsEnabled: true,
      appUpdateNotificationsEnabled: true,
      gameUpdateNotificationsEnabled: true,
      createBackupBeforeInstall: true,
      autoDetectInstalledGames: true,
      showAdultGames: false,
      showAiTranslations: false,
      liquidGlassEnabled: true,
      gamepadSoundsEnabled: true,
      isSettingsModalOpen: false,
      saveLogsToFile: false,
      sidebarWidth: 320,
      specialFilter: null,
      selectedAuthors: [],
      notificationSoundsEnabled: true,
      alphabetSidebarEnabled: true,

      setTheme: (theme) => set({ theme }),

      setSortOrder: (sortOrder) => set({ sortOrder }),

      toggleNotificationSounds: () =>
        set((state) => ({ notificationSoundsEnabled: !state.notificationSoundsEnabled })),

      setSpecialFilter: (specialFilter) => set({ specialFilter }),

      setSelectedAuthors: (selectedAuthors) => set({ selectedAuthors }),

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

      toggleShowAiTranslations: () =>
        set((state) => ({ showAiTranslations: !state.showAiTranslations })),

      toggleLiquidGlass: () =>
        set((state) => ({ liquidGlassEnabled: !state.liquidGlassEnabled })),

      toggleGamepadSounds: () =>
        set((state) => ({ gamepadSoundsEnabled: !state.gamepadSoundsEnabled })),

      toggleSaveLogsToFile: () =>
        set((state) => ({ saveLogsToFile: !state.saveLogsToFile })),

      toggleAlphabetSidebar: () =>
        set((state) => ({ alphabetSidebarEnabled: !state.alphabetSidebarEnabled })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),

      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    }),
    {
      name: 'lbk-settings',
      partialize: (state) => ({
        theme: state.theme,
        sortOrder: state.sortOrder,
        animationsEnabled: state.animationsEnabled,
        appUpdateNotificationsEnabled: state.appUpdateNotificationsEnabled,
        gameUpdateNotificationsEnabled: state.gameUpdateNotificationsEnabled,
        createBackupBeforeInstall: state.createBackupBeforeInstall,
        autoDetectInstalledGames: state.autoDetectInstalledGames,
        showAdultGames: state.showAdultGames,
        showAiTranslations: state.showAiTranslations,
        liquidGlassEnabled: state.liquidGlassEnabled,
        gamepadSoundsEnabled: state.gamepadSoundsEnabled,
        saveLogsToFile: state.saveLogsToFile,
        sidebarWidth: state.sidebarWidth,
        specialFilter: state.specialFilter,
        selectedAuthors: state.selectedAuthors,
        notificationSoundsEnabled: state.notificationSoundsEnabled,
        alphabetSidebarEnabled: state.alphabetSidebarEnabled,
      }),
    }
  )
);
