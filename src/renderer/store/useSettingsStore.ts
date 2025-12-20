import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  isSettingsModalOpen: boolean;
  saveLogsToFile: boolean;
  sidebarWidth: number;
  setTheme: (theme: ThemeMode) => void;
  toggleAnimations: () => void;
  toggleAppUpdateNotifications: () => void;
  toggleGameUpdateNotifications: () => void;
  toggleCreateBackup: () => void;
  toggleAutoDetectInstalledGames: () => void;
  toggleShowAdultGames: () => void;
  toggleLiquidGlass: () => void;
  toggleSaveLogsToFile: () => void;
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
      isSettingsModalOpen: false,
      saveLogsToFile: false,
      sidebarWidth: 320,

      setTheme: (theme) => set({ theme }),

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

      toggleSaveLogsToFile: () =>
        set((state) => ({ saveLogsToFile: !state.saveLogsToFile })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),

      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    }),
    {
      name: 'littlebit-settings',
    }
  )
);
