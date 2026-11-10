import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type Language } from '@/shared/i18n/languages';
import type {
  ContentTypeFilterType,
  SortOrderType,
  SpecialFilterType,
  TranslationTypeFilterType,
} from '../../shared/types';
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
  if (typeof window === 'undefined') {
    return false;
  }

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
  showAdultGames: boolean;
  hideAiTranslations: boolean;
  showRecommendations: boolean;
  liquidGlassEnabled: boolean;
  uiSoundsEnabled: boolean;
  steamCefDebuggingEnabled: boolean;
  steamCustomArtworkEnabled: boolean;
  millenniumOfferDeclined: boolean;
  deckyPluginOfferDeclined: boolean;
  // One-way: the nickname lever glows until it is first hovered or focused, on any later open too
  reviewLeverHintSeen: boolean;
  productAnalyticsEnabled: boolean;
  localizationAnalyticsEnabled: boolean;
  crashDiagnosticsEnabled: boolean;
  language: Language;
  isSettingsModalOpen: boolean;
  sidebarWidth: number;
  specialFilter: SpecialFilterType | null;
  selectedContentTypes: ContentTypeFilterType[];
  selectedTranslationTypes: TranslationTypeFilterType[];
  selectedAuthors: string[];
  selectedTagIds: number[];
  favoriteGameIds: string[];
  notificationSoundsEnabled: boolean;
  setSortOrder: (order: SortOrderType) => void;
  toggleNotificationSounds: () => void;
  setSpecialFilter: (filter: SpecialFilterType | null) => void;
  setSelectedContentTypes: (types: ContentTypeFilterType[]) => void;
  setSelectedTranslationTypes: (types: TranslationTypeFilterType[]) => void;
  setSelectedTagIds: (tagIds: number[]) => void;
  setSelectedAuthors: (authors: string[]) => void;
  toggleFavoriteGame: (gameId: string, gameName: string) => void;
  isFavoriteGame: (gameId: string) => boolean;
  toggleAnimations: () => void;
  toggleAppUpdateNotifications: () => void;
  toggleGameUpdateNotifications: () => void;
  toggleCreateBackup: () => void;
  toggleShowAdultGames: () => void;
  toggleHideAiTranslations: () => void;
  toggleRecommendations: () => void;
  toggleLiquidGlass: () => void;
  toggleUiSounds: () => void;
  toggleSteamCefDebugging: () => void;
  toggleSteamCustomArtwork: () => void;
  declineMillenniumOffer: () => void;
  declineDeckyPluginOffer: () => void;
  markReviewLeverHintSeen: () => void;
  toggleProductAnalytics: () => void;
  toggleLocalizationAnalytics: () => void;
  toggleCrashDiagnostics: () => void;
  setLanguage: (language: Language) => void;
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
      showAdultGames: false,
      hideAiTranslations: false,
      showRecommendations: true,
      liquidGlassEnabled: fancyEffectsByDefault,
      uiSoundsEnabled: true,
      steamCefDebuggingEnabled: true,
      steamCustomArtworkEnabled: true,
      millenniumOfferDeclined: false,
      deckyPluginOfferDeclined: false,
      reviewLeverHintSeen: false,
      productAnalyticsEnabled: true,
      localizationAnalyticsEnabled: true,
      crashDiagnosticsEnabled: true,
      language: DEFAULT_LANGUAGE,
      isSettingsModalOpen: false,
      sidebarWidth: 320,
      specialFilter: null,
      selectedContentTypes: [],
      selectedTranslationTypes: [],
      selectedAuthors: [],
      selectedTagIds: [],
      favoriteGameIds: [],
      notificationSoundsEnabled: true,
      setSortOrder: (sortOrder) => set({ sortOrder }),

      toggleNotificationSounds: () =>
        set((state) => ({ notificationSoundsEnabled: !state.notificationSoundsEnabled })),

      setSpecialFilter: (specialFilter) => set({ specialFilter }),

      setSelectedContentTypes: (selectedContentTypes) => set({ selectedContentTypes }),

      setSelectedTranslationTypes: (selectedTranslationTypes) =>
        set({ selectedTranslationTypes }),

      setSelectedAuthors: (selectedAuthors) => set({ selectedAuthors }),

      setSelectedTagIds: (selectedTagIds) => set({ selectedTagIds }),

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
        if (isHardwareWeak) {
          return;
        }
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

      toggleShowAdultGames: () =>
        set((state) => ({ showAdultGames: !state.showAdultGames })),

      // Enabling this hides the whole "Тип перекладу" filter block (see
      // FiltersModal), so clear any selection there - it'd otherwise stay
      // active but be invisible and unreachable in the UI.
      toggleHideAiTranslations: () =>
        set((state) => {
          const hideAiTranslations = !state.hideAiTranslations;
          return {
            hideAiTranslations,
            selectedTranslationTypes: hideAiTranslations
              ? []
              : state.selectedTranslationTypes,
          };
        }),

      toggleRecommendations: () =>
        set((state) => ({ showRecommendations: !state.showRecommendations })),

      toggleLiquidGlass: () => {
        if (isHardwareWeak) {
          return;
        }
        set((state) => ({ liquidGlassEnabled: !state.liquidGlassEnabled }));
      },

      toggleUiSounds: () => set((state) => ({ uiSoundsEnabled: !state.uiSoundsEnabled })),

      toggleSteamCefDebugging: () =>
        set((state) => ({ steamCefDebuggingEnabled: !state.steamCefDebuggingEnabled })),

      toggleSteamCustomArtwork: () =>
        set((state) => ({ steamCustomArtworkEnabled: !state.steamCustomArtworkEnabled })),

      declineMillenniumOffer: () => set({ millenniumOfferDeclined: true }),

      declineDeckyPluginOffer: () => set({ deckyPluginOfferDeclined: true }),

      markReviewLeverHintSeen: () => set({ reviewLeverHintSeen: true }),

      toggleProductAnalytics: () =>
        set((state) => ({ productAnalyticsEnabled: !state.productAnalyticsEnabled })),

      toggleLocalizationAnalytics: () =>
        set((state) => ({
          localizationAnalyticsEnabled: !state.localizationAnalyticsEnabled,
        })),

      toggleCrashDiagnostics: () =>
        set((state) => ({ crashDiagnosticsEnabled: !state.crashDiagnosticsEnabled })),

      setLanguage: (language) => set({ language }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),

      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
    }),
    {
      name: 'lbk-settings',
      storage: createJSONStorage(() => electronStorage),
      version: 1,
      // Version 0 kept the interface sounds under their first use, the gamepad
      migrate: (persisted) => {
        const { gamepadSoundsEnabled = true, ...settings } =
          persisted as Partial<SettingsStore> & {
            gamepadSoundsEnabled?: boolean;
          };
        return { ...settings, uiSoundsEnabled: gamepadSoundsEnabled };
      },
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
        showAdultGames: state.showAdultGames,
        hideAiTranslations: state.hideAiTranslations,
        showRecommendations: state.showRecommendations,
        liquidGlassEnabled: state.liquidGlassEnabled,
        uiSoundsEnabled: state.uiSoundsEnabled,
        steamCefDebuggingEnabled: state.steamCefDebuggingEnabled,
        steamCustomArtworkEnabled: state.steamCustomArtworkEnabled,
        millenniumOfferDeclined: state.millenniumOfferDeclined,
        deckyPluginOfferDeclined: state.deckyPluginOfferDeclined,
        reviewLeverHintSeen: state.reviewLeverHintSeen,
        productAnalyticsEnabled: state.productAnalyticsEnabled,
        localizationAnalyticsEnabled: state.localizationAnalyticsEnabled,
        crashDiagnosticsEnabled: state.crashDiagnosticsEnabled,
        language: state.language,
        sidebarWidth: state.sidebarWidth,
        specialFilter: state.specialFilter,
        selectedContentTypes: state.selectedContentTypes,
        selectedTranslationTypes: state.selectedTranslationTypes,
        selectedAuthors: state.selectedAuthors,
        selectedTagIds: state.selectedTagIds,
        favoriteGameIds: state.favoriteGameIds,
        notificationSoundsEnabled: state.notificationSoundsEnabled,
      }),
    }
  )
);
