import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SortOrderType } from '../../shared/types';
import type { SpecialFilterType } from '../components/Sidebar/types';
import { electronStorage } from './electronStorage';
import { useSubscriptionsStore } from './useSubscriptionsStore';

/**
 * Heuristic: low-end hardware (Steam Deck, old Macs/PCs) where the heavy
 * animations and liquid-glass effects would lag.
 *
 * Prefers `electronAPI.getSystemInfo()` (Node `os` module, accurate) over
 * `navigator.deviceMemory` (Chromium-capped at 8GB, useless for thresholding).
 */
function detectWeakHardware(): boolean {
  if (typeof window === 'undefined') return false;

  // Respect the OS-level reduced-motion preference first.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;

  const info = window.electronAPI?.getSystemInfo?.();
  if (info) {
    return info.cpuCount <= 4 || info.totalRamGB <= 8;
  }

  // Browser fallback (dev preview without preload).
  const cores = navigator.hardwareConcurrency ?? 8;
  return cores <= 4;
}

/** Detected once at module load; consumers can import for UI gating. */
export const isHardwareWeak = detectWeakHardware();
const fancyEffectsByDefault = !isHardwareWeak;

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
      animationsEnabled: fancyEffectsByDefault,
      appUpdateNotificationsEnabled: true,
      gameUpdateNotificationsEnabled: true,
      createBackupBeforeInstall: true,
      autoDetectInstalledGames: true,
      showAdultGames: false,
      hideAiTranslations: false,
      liquidGlassEnabled: fancyEffectsByDefault,
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

      // No-op on weak hardware — UI also disables the toggle, but guard the
      // setter too in case it's called from elsewhere (keyboard shortcut, etc.).
      toggleAnimations: () => {
        if (isHardwareWeak) return;
        set((state) => ({ animationsEnabled: !state.animationsEnabled }));
      },

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

      toggleLiquidGlass: () => {
        if (isHardwareWeak) return;
        set((state) => ({ liquidGlassEnabled: !state.liquidGlassEnabled }));
      },

      toggleGamepadSounds: () =>
        set((state) => ({ gamepadSoundsEnabled: !state.gamepadSoundsEnabled })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),

      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    }),
    {
      name: 'lbk-settings',
      storage: createJSONStorage(() => electronStorage),
      // Override the persisted choice for fancy effects when hardware is weak,
      // so a setting saved on a stronger machine (or older app version) can't
      // re-enable lag on the current machine.
      onRehydrateStorage: () => (state) => {
        if (isHardwareWeak && state) {
          state.animationsEnabled = false;
          state.liquidGlassEnabled = false;
        }
      },
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
