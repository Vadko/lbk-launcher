import { create } from 'zustand';

type NavigationArea = 'header' | 'games' | 'main-content';

export type GamepadHintContext =
  | 'games'
  | 'header'
  | 'main-content'
  | 'modal'
  | 'dropdown'
  | 'text-input'
  | 'search-input';

interface GamepadModeStore {
  // Mode
  isGamepadMode: boolean;
  setGamepadMode: (enabled: boolean) => void;

  // Navigation state
  focusedGameIndex: number;
  setFocusedGameIndex: (index: number) => void;
  navigationArea: NavigationArea;
  setNavigationArea: (area: NavigationArea) => void;

  // Derived from the DOM by the navigation loop; drives the hint bar
  hintContext: GamepadHintContext;
  setHintContext: (context: GamepadHintContext) => void;

  isHelpOpen: boolean;
  setHelpOpen: (open: boolean) => void;

  // The virtualized list registers its virtualizer.scrollToIndex so
  // gamepad navigation can scroll to a card that isn't mounted yet
  scrollGameListToIndex: ((index: number) => void) | null;
  setScrollGameListToIndex: (fn: ((index: number) => void) | null) => void;

  // The element id of a review entry revealed behind a dialog, for the loop to focus once the dialog closes
  entryHandOver: string | null;
  handOverEntry: (elementId: string) => void;
  takeEntryHandOver: () => string | null;

  // Reset navigation when mode changes
  resetNavigation: () => void;
}

export const useGamepadModeStore = create<GamepadModeStore>((set, get) => ({
  isGamepadMode: false,
  setGamepadMode: (enabled) =>
    set((state) => ({
      isGamepadMode: enabled,
      // Reset navigation state when mode changes
      focusedGameIndex: enabled ? 0 : state.focusedGameIndex,
      navigationArea: enabled ? 'games' : state.navigationArea,
      isHelpOpen: enabled ? state.isHelpOpen : false,
      // A mode change restarts the loop that would take it
      entryHandOver: enabled === state.isGamepadMode ? state.entryHandOver : null,
    })),

  focusedGameIndex: 0,
  setFocusedGameIndex: (index) => set({ focusedGameIndex: index }),

  navigationArea: 'games',
  setNavigationArea: (area) => set({ navigationArea: area }),

  hintContext: 'games',
  setHintContext: (context) => set({ hintContext: context }),

  isHelpOpen: false,
  setHelpOpen: (open) => set({ isHelpOpen: open }),

  scrollGameListToIndex: null,
  setScrollGameListToIndex: (fn) => set({ scrollGameListToIndex: fn }),

  entryHandOver: null,
  handOverEntry: (elementId) => set({ entryHandOver: elementId }),
  takeEntryHandOver: () => {
    const { entryHandOver } = get();
    if (entryHandOver !== null) {
      set({ entryHandOver: null });
    }
    return entryHandOver;
  },

  resetNavigation: () =>
    set({
      focusedGameIndex: 0,
      navigationArea: 'games',
    }),
}));
