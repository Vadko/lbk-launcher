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
  shouldShowModal: () => boolean;
  checkAndResetNeverShow: () => boolean; // Новий action для скидання
  markAsShownForSession: () => void;
  resetShowingState: () => void;
  setDevMode: (mode: DevModeType) => void;
}

const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000; // 20 днів у мілісекундах
const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 години у мілісекундах

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

      shouldShowModal: () => {
        const state = get();

        // Dev mode overrides
        if (state.devMode === 'never') {
          return false;
        }
        if (state.devMode === 'always') {
          return !state.isOpen; // Show always but not if already open
        }

        // Normal logic for 'normal' dev mode
        // Якщо користувач вибрав "більше не показувати"
        if (state.neverShowAgain) {
          // Перевіряємо чи пройшло 20 днів (БЕЗ side effect!)
          if (state.lastShownAt && Date.now() - state.lastShownAt < TWENTY_DAYS_MS) {
            return false;
          }
          // Якщо пройшло 20 днів, можна показувати (але не скидаємо тут!)
          return true;
        }

        // Якщо вже показували в цій сесії
        if (state.hasShownOnCurrentSession) {
          return false;
        }

        // Якщо модалка відкрита
        if (state.isOpen) {
          return false;
        }

        // Якщо модалку закрили через хрестик, перевіряємо 24 години
        if (state.lastShownAt && Date.now() - state.lastShownAt < ONE_DAY_MS) {
          return false;
        }

        return true;
      },

      checkAndResetNeverShow: () => {
        const state = get();
        
        // Скидаємо neverShowAgain якщо пройшло 20 днів
        if (state.neverShowAgain && state.lastShownAt && 
            Date.now() - state.lastShownAt >= TWENTY_DAYS_MS) {
          set({ neverShowAgain: false });
          return true; // Повертаємо true якщо скинули
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
