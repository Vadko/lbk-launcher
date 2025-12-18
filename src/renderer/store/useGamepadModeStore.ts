import { create } from 'zustand';

type NavigationArea = 'header' | 'games' | 'main-content' | 'modal';

interface GamepadModeStore {
  // Mode
  isGamepadMode: boolean;
  setGamepadMode: (enabled: boolean) => void;

  // Track last input method to show/hide gamepad focus styles
  lastInputMethod: 'gamepad' | 'keyboard' | 'mouse';
  setLastInputMethod: (method: 'gamepad' | 'keyboard' | 'mouse') => void;

  // Track if user manually disabled gamepad mode (to prevent auto-enable)
  userDisabledGamepadMode: boolean;
  setUserDisabledGamepadMode: (disabled: boolean) => void;

  // Navigation state
  focusedGameIndex: number;
  setFocusedGameIndex: (index: number) => void;
  navigationArea: NavigationArea;
  setNavigationArea: (area: NavigationArea) => void;
  totalGames: number;
  setTotalGames: (count: number) => void;

  // Reset navigation when mode changes
  resetNavigation: () => void;
}

export const useGamepadModeStore = create<GamepadModeStore>((set) => ({
  isGamepadMode: false,
  setGamepadMode: (enabled) =>
    set((state) => ({
      isGamepadMode: enabled,
      // Reset navigation state when mode changes
      focusedGameIndex: enabled ? 0 : state.focusedGameIndex,
      navigationArea: enabled ? 'games' : state.navigationArea,
      lastInputMethod: enabled ? 'gamepad' : state.lastInputMethod,
    })),

  lastInputMethod: 'mouse',
  setLastInputMethod: (method) => set({ lastInputMethod: method }),

  userDisabledGamepadMode: false,
  setUserDisabledGamepadMode: (disabled) => set({ userDisabledGamepadMode: disabled }),

  focusedGameIndex: 0,
  setFocusedGameIndex: (index) => set({ focusedGameIndex: index }),

  navigationArea: 'games',
  setNavigationArea: (area) => set({ navigationArea: area }),

  totalGames: 0,
  setTotalGames: (count) => set({ totalGames: count }),

  resetNavigation: () =>
    set({
      focusedGameIndex: 0,
      navigationArea: 'games',
    }),
}));
