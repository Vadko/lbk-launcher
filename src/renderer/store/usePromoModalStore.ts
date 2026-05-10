import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { electronStorage } from './electronStorage';

export type DevModeType = 'normal' | 'always' | 'never';

interface PromoModalState {
  lastShownAt: number | null;
  neverShowAgain: boolean;
  isOpen: boolean;
  hasShownOnCurrentSession: boolean;
  devMode: DevModeType;
}

interface PromoModalStore extends PromoModalState {
  openModal: () => void;
  closeModal: (dontRemind?: boolean) => void;
  shouldShowModal: (ignoreDontShowAgain?: boolean) => boolean;
  checkAndResetNeverShow: () => boolean;
  markAsShownForSession: () => void;
  resetShowingState: () => void;
  setDevMode: (mode: DevModeType) => void;
}

const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const usePromoModalStore = create<PromoModalStore>()(
  persist(
    (set, get) => ({
      lastShownAt: null,
      neverShowAgain: false,
      isOpen: false,
      hasShownOnCurrentSession: false,
      devMode: 'normal' as DevModeType,

      openModal: () => {
        set({ isOpen: true, hasShownOnCurrentSession: true, lastShownAt: Date.now() });
      },

      closeModal: (dontRemind = false) => {
        if (dontRemind) {
          set({
            isOpen: false,
            neverShowAgain: true,
            lastShownAt: Date.now(),
          });
        } else {
          set({
            isOpen: false,
            lastShownAt: Date.now(),
          });
        }
      },

      shouldShowModal: (ignoreDontShowAgain = false) => {
        const state = get();

        // Dev mode overrides (development only)
        if (import.meta.env.DEV) {
          if (state.devMode === 'never') {
            return false;
          }
          if (state.devMode === 'always') {
            return !state.isOpen;
          }
        }

        if (state.hasShownOnCurrentSession) {
          return false;
        }

        if (state.isOpen) {
          return false;
        }

        // 24 hours cooldown
        if (state.lastShownAt && Date.now() - state.lastShownAt < ONE_DAY_MS) {
          return false;
        }

        // Ad banners ignore checkbox, SupportContent respects it
        if (!ignoreDontShowAgain && state.neverShowAgain) {
          if (state.lastShownAt && Date.now() - state.lastShownAt < TWENTY_DAYS_MS) {
            return false;
          }
        }

        return true;
      },

      checkAndResetNeverShow: () => {
        const state = get();

        if (
          state.neverShowAgain &&
          state.lastShownAt &&
          Date.now() - state.lastShownAt >= TWENTY_DAYS_MS
        ) {
          set({ neverShowAgain: false });
          return true;
        }

        return false;
      },

      markAsShownForSession: () => {
        set({ hasShownOnCurrentSession: true });
      },

      resetShowingState: () => {
        set({ hasShownOnCurrentSession: false });
      },

      setDevMode: (mode: DevModeType) => {
        set({ devMode: mode });
      },
    }),
    {
      name: 'promo-modal-storage',
      storage: createJSONStorage(() => electronStorage),
      partialize: (state) => ({
        lastShownAt: state.lastShownAt,
        neverShowAgain: state.neverShowAgain,
        devMode: state.devMode,
      }),
    }
  )
);
