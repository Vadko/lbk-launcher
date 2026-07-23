import { create } from 'zustand';

type NavigationArea = 'header' | 'games' | 'main-content';

interface GamepadModeStore {
  // Mode
  isGamepadMode: boolean;
  setGamepadMode: (enabled: boolean) => void;

  // Navigation state
  focusedGameIndex: number;
  setFocusedGameIndex: (index: number) => void;
  navigationArea: NavigationArea;
  setNavigationArea: (area: NavigationArea) => void;
  totalGames: number;
  setTotalGames: (count: number) => void;

  // Віртуалізована стрічка реєструє свій virtualizer.scrollToIndex, щоб
  // геймпад-навігація могла доскролити до ще не змонтованої картки
  scrollGameListToIndex: ((index: number) => void) | null;
  setScrollGameListToIndex: (fn: ((index: number) => void) | null) => void;

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
    })),

  focusedGameIndex: 0,
  setFocusedGameIndex: (index) => set({ focusedGameIndex: index }),

  navigationArea: 'games',
  setNavigationArea: (area) => set({ navigationArea: area }),

  totalGames: 0,
  setTotalGames: (count) => set({ totalGames: count }),

  scrollGameListToIndex: null,
  setScrollGameListToIndex: (fn) => set({ scrollGameListToIndex: fn }),

  resetNavigation: () =>
    set({
      focusedGameIndex: 0,
      navigationArea: 'games',
    }),
}));
