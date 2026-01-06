import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecialFilterType } from '../components/Sidebar/types';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsStore {
  theme: ThemeMode;
  animationsEnabled: boolean;
  appUpdateNotificationsEnabled: boolean;
  gameUpdateNotificationsEnabled: boolean;
  createBackupBeforeInstall: boolean;
  autoDetectInstalledGames: boolean;
  showAdultGames: boolean;
  liquidGlassEnabled: boolean;
  christmasEffectsEnabled: boolean;
  gamepadSoundsEnabled: boolean;
  isSettingsModalOpen: boolean;
  saveLogsToFile: boolean;
  sidebarWidth: number;
  specialFilter: SpecialFilterType | null;
  selectedAuthors: string[];
  notificationSoundsEnabled: boolean;
  alphabetSidebarEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleNotificationSounds: () => void;
  setSpecialFilter: (filter: SpecialFilterType | null) => void;
  setSelectedAuthors: (authors: string[]) => void;
  toggleAnimations: () => void;
  toggleAppUpdateNotifications: () => void;
  toggleGameUpdateNotifications: () => void;
  toggleCreateBackup: () => void;
  toggleAutoDetectInstalledGames: () => void;
  toggleShowAdultGames: () => void;
  toggleLiquidGlass: () => void;
  toggleChristmasEffects: () => void;
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
      animationsEnabled: true,
      appUpdateNotificationsEnabled: true,
      gameUpdateNotificationsEnabled: true,
      createBackupBeforeInstall: true,
      autoDetectInstalledGames: true,
      showAdultGames: false,
      liquidGlassEnabled: true,
      christmasEffectsEnabled: true,
      gamepadSoundsEnabled: true,
      isSettingsModalOpen: false,
      saveLogsToFile: false,
      sidebarWidth: 320,
      specialFilter: null,
      selectedAuthors: [],
      notificationSoundsEnabled: true,
      alphabetSidebarEnabled: true,

      setTheme: (theme) => set({ theme }),

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

      toggleLiquidGlass: () =>
        set((state) => ({ liquidGlassEnabled: !state.liquidGlassEnabled })),

      toggleChristmasEffects: () =>
        set((state) => ({ christmasEffectsEnabled: !state.christmasEffectsEnabled })),

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
      name: 'littlebit-settings',
      partialize: (state) => ({
        theme: state.theme,
        animationsEnabled: state.animationsEnabled,
        appUpdateNotificationsEnabled: state.appUpdateNotificationsEnabled,
        gameUpdateNotificationsEnabled: state.gameUpdateNotificationsEnabled,
        createBackupBeforeInstall: state.createBackupBeforeInstall,
        autoDetectInstalledGames: state.autoDetectInstalledGames,
        showAdultGames: state.showAdultGames,
        liquidGlassEnabled: state.liquidGlassEnabled,
        christmasEffectsEnabled: state.christmasEffectsEnabled,
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
