import { useEffect, useRef, useCallback, useState } from 'react';
import { useGamepads } from 'react-ts-gamepads';
import { useGamepadModeStore } from '../store/useGamepadModeStore';

// Gamepad button mapping (Xbox layout)
const BUTTON = {
  A: 0, // Confirm/Select
  B: 1, // Back/Cancel
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
};

const DEADZONE = 0.5;
const INPUT_DELAY = 180;
const SCROLL_AMOUNT = 300;

// Audio context for sound effects
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playNavigateSound(): void {
  if (!document.hasFocus()) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  } catch {
    // Audio not available
  }
}

function playConfirmSound(): void {
  if (!document.hasFocus()) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.08);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio not available
  }
}

function playBackSound(): void {
  if (!document.hasFocus()) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(500, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio not available
  }
}

/**
 * Gamepad navigation hook for gamepad mode
 * - Left/Right: Navigate between game cards
 * - Up/Down: Scroll main content
 * - A: Select game / Confirm in modal
 * - B: Back / Cancel in modal
 */
export function useGamepadModeNavigation(enabled: boolean = true) {
  const lastInputRef = useRef<Record<string, number>>({});
  const gameCardsRef = useRef<HTMLElement[]>([]);
  const [gamepads, setGamepads] = useState<Record<number, Gamepad>>({});

  const {
    focusedGameIndex,
    setFocusedGameIndex,
    navigationArea,
    setNavigationArea,
    totalGames,
  } = useGamepadModeStore();

  const prevNavigationAreaRef = useRef<string | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef<boolean>(false);
  const prevButtonStatesRef = useRef<boolean[]>([]);

  // Subscribe to gamepad state
  useGamepads((pads) => setGamepads(pads));

  // Input debouncing
  const canInput = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastTime = lastInputRef.current[key] || 0;
    if (now - lastTime < INPUT_DELAY) return false;
    lastInputRef.current[key] = now;
    return true;
  }, []);

  // Check if button was just pressed (transition from unpressed to pressed)
  const isButtonJustPressed = useCallback((gp: Gamepad, buttonIndex: number): boolean => {
    const currentPressed = gp.buttons[buttonIndex]?.pressed ?? false;
    const prevPressed = prevButtonStatesRef.current[buttonIndex] ?? false;
    return currentPressed && !prevPressed;
  }, []);

  // Update previous button states (call at end of each frame)
  const updatePrevButtonStates = useCallback((gp: Gamepad) => {
    prevButtonStatesRef.current = gp.buttons.map(b => b?.pressed ?? false);
  }, []);

  // Get game cards from DOM
  const getGameCards = useCallback((): HTMLElement[] => {
    const cards = document.querySelectorAll<HTMLElement>('[data-gamepad-card]');
    return Array.from(cards);
  }, []);

  // Scroll card into view
  const scrollCardIntoView = useCallback((card: HTMLElement) => {
    const container = document.querySelector('[data-gamepad-game-list]');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    // Check if card is outside visible area
    if (cardRect.left < containerRect.left) {
      container.scrollBy({
        left: cardRect.left - containerRect.left - 16,
        behavior: 'smooth',
      });
    } else if (cardRect.right > containerRect.right) {
      container.scrollBy({
        left: cardRect.right - containerRect.right + 16,
        behavior: 'smooth',
      });
    }
  }, []);

  // Navigate to specific game card
  const navigateToGame = useCallback(
    (index: number) => {
      const cards = getGameCards();
      if (cards.length === 0 || index < 0 || index >= cards.length) return;

      setFocusedGameIndex(index);
      const card = cards[index];
      card.focus();
      scrollCardIntoView(card);
      playNavigateSound();
    },
    [getGameCards, setFocusedGameIndex, scrollCardIntoView]
  );

  // Select current game
  const selectCurrentGame = useCallback(() => {
    const cards = getGameCards();
    if (cards.length === 0) return;

    const card = cards[focusedGameIndex];
    if (card) {
      playConfirmSound();
      card.click();
      // Switch to main content area only if no modal opened
      // (modal check happens in the main polling effect)
      setTimeout(() => {
        const modalOpen = !!document.querySelector('[role="dialog"]');
        if (!modalOpen) {
          setNavigationArea('main-content');
        }
      }, 50);
    }
  }, [getGameCards, focusedGameIndex, setNavigationArea]);

  // Scroll main content
  const scrollMainContent = useCallback((direction: 'up' | 'down') => {
    const mainContent = document.querySelector('[data-gamepad-main-content]');
    if (!mainContent) return;

    mainContent.scrollBy({
      top: direction === 'up' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  }, []);

  // Handle modal navigation
  const handleModalNavigation = useCallback(
    (gp: Gamepad) => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return;

      // Get all focusable elements in modal
      const allFocusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-gamepad-modal-item]:not([disabled])'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        // Skip elements marked as skip
        if (el.hasAttribute('data-gamepad-skip')) return false;
        // Exclude small X close button in Modal component's header (button in border-b with only SVG child)
        if (el.tagName === 'BUTTON' && el.closest('.border-b')) {
          const children = el.children;
          if (children.length === 1 && children[0].tagName.toLowerCase() === 'svg') return false;
        }
        return true;
      });

      // Sort: inputs/checkboxes first (in DOM order), then confirm button, then cancel button last
      const focusableElements = [...allFocusable].sort((a, b) => {
        const aIsInput = a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA';
        const bIsInput = b.tagName === 'INPUT' || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA';
        const aIsConfirm = a.hasAttribute('data-gamepad-confirm');
        const bIsConfirm = b.hasAttribute('data-gamepad-confirm');
        const aIsCancel = a.hasAttribute('data-gamepad-cancel');
        const bIsCancel = b.hasAttribute('data-gamepad-cancel');

        // Inputs/checkboxes come first
        if (aIsInput && !bIsInput) return -1;
        if (!aIsInput && bIsInput) return 1;

        // Cancel button goes to the end
        if (aIsCancel && !bIsCancel) return 1;
        if (!aIsCancel && bIsCancel) return -1;

        // Confirm button comes before other non-input buttons
        if (aIsConfirm && !bIsConfirm && !bIsInput) return -1;
        if (!aIsConfirm && bIsConfirm && !aIsInput) return 1;

        // Keep DOM order for same type
        return 0;
      });

      if (focusableElements.length === 0) return;

      const currentFocused = document.activeElement as HTMLElement;
      let currentIndex = focusableElements.indexOf(currentFocused);

      // If nothing focused in modal, focus first element
      if (currentIndex === -1) {
        focusableElements[0]?.focus();
        return;
      }

      // Up/Down navigation
      const upPressed =
        (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('modal-up')) ||
        (gp.axes[AXIS.LEFT_Y] < -DEADZONE && canInput('modal-stick-up'));
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('modal-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('modal-stick-down'));

      // Left/Right navigation (for buttons side by side)
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('modal-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('modal-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('modal-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('modal-stick-right'));

      if (upPressed) {
        const nextIndex =
          currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        focusableElements[nextIndex].focus();
        focusableElements[nextIndex].scrollIntoView({ block: 'nearest' });
        playNavigateSound();
      }

      if (downPressed) {
        const nextIndex =
          currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        focusableElements[nextIndex].focus();
        focusableElements[nextIndex].scrollIntoView({ block: 'nearest' });
        playNavigateSound();
      }

      // Left/Right for switching between cancel/confirm buttons
      if (leftPressed && currentIndex > 0) {
        focusableElements[currentIndex - 1].focus();
        playNavigateSound();
      }

      if (rightPressed && currentIndex < focusableElements.length - 1) {
        focusableElements[currentIndex + 1].focus();
        playNavigateSound();
      }

      // A button - confirm/click (only on button press, not hold)
      if (isButtonJustPressed(gp, BUTTON.A) && canInput('modal-button-a')) {
        const focused = document.activeElement as HTMLElement;
        if (focused && focusableElements.includes(focused)) {
          playConfirmSound();
          focused.click();
        }
      }

      // B button - cancel/close (only on button press, not hold)
      if (isButtonJustPressed(gp, BUTTON.B) && canInput('modal-button-b')) {
        // Find cancel button by data attribute
        const cancelButton =
          modal.querySelector<HTMLButtonElement>('[data-gamepad-cancel]');
        if (cancelButton) {
          playBackSound();
          cancelButton.click();
        }
      }
    },
    [canInput, isButtonJustPressed]
  );

  // Get action buttons from MainContent
  const getActionButtons = useCallback((): HTMLElement[] => {
    const buttons = document.querySelectorAll<HTMLElement>('[data-gamepad-action]:not([disabled])');
    return Array.from(buttons);
  }, []);

  // Handle main content navigation
  const handleMainContentNavigation = useCallback(
    (gp: Gamepad) => {
      const actionButtons = getActionButtons();

      // Find currently focused button
      const currentFocused = document.activeElement as HTMLElement;
      let currentIndex = actionButtons.indexOf(currentFocused);

      // Auto-focus first button only when first entering this area
      const justEntered = prevNavigationAreaRef.current !== 'main-content';
      if (justEntered && actionButtons.length > 0) {
        // Focus the primary action or first available button
        const primaryButton = actionButtons.find((b) =>
          b.hasAttribute('data-gamepad-primary-action')
        );
        (primaryButton || actionButtons[0]).focus();
        currentIndex = actionButtons.indexOf(
          (primaryButton || actionButtons[0]) as HTMLElement
        );
      }

      // B button - go back to games
      if (gp.buttons[BUTTON.B]?.pressed && canInput('button-b')) {
        playBackSound();
        setNavigationArea('games');
        // Re-focus the current game card
        const cards = getGameCards();
        if (cards[focusedGameIndex]) {
          cards[focusedGameIndex].focus();
        }
        return;
      }

      // Up/Down - scroll content
      const upPressed =
        (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('main-up')) ||
        (gp.axes[AXIS.LEFT_Y] < -DEADZONE && canInput('main-stick-up'));
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('main-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('main-stick-down'));

      if (upPressed) {
        scrollMainContent('up');
      }
      if (downPressed) {
        scrollMainContent('down');
      }

      // Left/Right - navigate between action buttons
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('main-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('main-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('main-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('main-stick-right'));

      if (actionButtons.length > 0) {
        // If no button focused yet, focus first one on any direction press
        if (currentIndex === -1 && (leftPressed || rightPressed)) {
          actionButtons[0].focus();
          playNavigateSound();
          return;
        }

        if (leftPressed && currentIndex > 0) {
          actionButtons[currentIndex - 1].focus();
          playNavigateSound();
        }

        if (rightPressed && currentIndex < actionButtons.length - 1) {
          actionButtons[currentIndex + 1].focus();
          playNavigateSound();
        }
      }

      // A button - click focused button or primary action
      if (gp.buttons[BUTTON.A]?.pressed && canInput('button-a')) {
        // If a button is focused, click it
        if (currentIndex !== -1) {
          playConfirmSound();
          actionButtons[currentIndex].click();
          return;
        }

        // Fallback to primary action button
        const primaryButton = document.querySelector<HTMLButtonElement>(
          '[data-gamepad-primary-action]'
        );
        if (primaryButton && !primaryButton.disabled) {
          playConfirmSound();
          primaryButton.click();
        }
      }
    },
    [
      canInput,
      focusedGameIndex,
      getActionButtons,
      getGameCards,
      scrollMainContent,
      setNavigationArea,
    ]
  );

  // Get header items from DOM
  const getHeaderItems = useCallback((): HTMLElement[] => {
    const items = document.querySelectorAll<HTMLElement>('[data-gamepad-header-item]');
    return Array.from(items);
  }, []);

  // Get dropdown items from open dropdown
  const getDropdownItems = useCallback((): HTMLElement[] => {
    const dropdown = document.querySelector('[data-gamepad-dropdown]');
    if (!dropdown) return [];
    const items = dropdown.querySelectorAll<HTMLElement>('[data-gamepad-dropdown-item]');
    return Array.from(items);
  }, []);

  // Check if dropdown is open
  const isDropdownOpen = useCallback((): boolean => {
    return !!document.querySelector('[data-gamepad-dropdown]');
  }, []);

  // Handle header navigation
  const handleHeaderNavigation = useCallback(
    (gp: Gamepad) => {
      // Check if dropdown is open - handle dropdown navigation
      if (isDropdownOpen()) {
        const dropdownItems = getDropdownItems();
        if (dropdownItems.length === 0) return;

        const currentFocused = document.activeElement as HTMLElement;
        let currentIndex = dropdownItems.indexOf(currentFocused);

        // If nothing focused in dropdown, focus first item
        if (currentIndex === -1) {
          dropdownItems[0].focus();
          return;
        }

        // Up/Down - navigate within dropdown
        const upPressed =
          (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('dropdown-up')) ||
          (gp.axes[AXIS.LEFT_Y] < -DEADZONE && canInput('dropdown-stick-up'));
        const downPressed =
          (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('dropdown-down')) ||
          (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('dropdown-stick-down'));

        if (upPressed && currentIndex > 0) {
          dropdownItems[currentIndex - 1].focus();
          dropdownItems[currentIndex - 1].scrollIntoView({ block: 'nearest' });
          playNavigateSound();
        }

        if (downPressed && currentIndex < dropdownItems.length - 1) {
          dropdownItems[currentIndex + 1].focus();
          dropdownItems[currentIndex + 1].scrollIntoView({ block: 'nearest' });
          playNavigateSound();
        }

        // A button - select item
        if (gp.buttons[BUTTON.A]?.pressed && canInput('button-a')) {
          const focused = document.activeElement as HTMLElement;
          if (focused && dropdownItems.includes(focused)) {
            playConfirmSound();
            focused.click();
          }
        }

        // B button - close dropdown
        if (gp.buttons[BUTTON.B]?.pressed && canInput('button-b')) {
          playBackSound();
          // Dispatch mousedown event to trigger outside click handler
          const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          document.body.dispatchEvent(event);
        }

        return;
      }

      // Normal header navigation
      const items = getHeaderItems();
      if (items.length === 0) return;

      // Find currently focused item
      const currentFocused = document.activeElement as HTMLElement;
      let currentIndex = items.findIndex(
        (item) => item.contains(currentFocused) || item === currentFocused
      );

      // If nothing focused, focus first item
      if (currentIndex === -1) {
        const firstInput = items[0].querySelector<HTMLElement>('input, button, [tabindex]');
        if (firstInput) firstInput.focus();
        else items[0].focus();
        return;
      }

      // Left/Right - navigate between items
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('header-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('header-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('header-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('header-stick-right'));

      if (leftPressed && currentIndex > 0) {
        const prevItem = items[currentIndex - 1];
        const focusTarget = prevItem.querySelector<HTMLElement>('input, button, [tabindex]');
        if (focusTarget) focusTarget.focus();
        else prevItem.focus();
        playNavigateSound();
      }

      if (rightPressed && currentIndex < items.length - 1) {
        const nextItem = items[currentIndex + 1];
        const focusTarget = nextItem.querySelector<HTMLElement>('input, button, [tabindex]');
        if (focusTarget) focusTarget.focus();
        else nextItem.focus();
        playNavigateSound();
      }

      // Down - go to games
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('header-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('header-stick-down'));

      if (downPressed) {
        playNavigateSound();
        setNavigationArea('games');
        const cards = getGameCards();
        if (cards[focusedGameIndex]) {
          cards[focusedGameIndex].focus();
        }
      }

      // A button - activate (click dropdown button)
      if (gp.buttons[BUTTON.A]?.pressed && canInput('button-a')) {
        const focused = document.activeElement as HTMLElement;
        if (focused) {
          playConfirmSound();
          focused.click();
        }
      }

      // B button - go to games
      if (gp.buttons[BUTTON.B]?.pressed && canInput('button-b')) {
        playBackSound();
        setNavigationArea('games');
        const cards = getGameCards();
        if (cards[focusedGameIndex]) {
          cards[focusedGameIndex].focus();
        }
      }
    },
    [canInput, focusedGameIndex, getGameCards, getHeaderItems, getDropdownItems, isDropdownOpen, setNavigationArea]
  );

  // Handle games navigation
  const handleGamesNavigation = useCallback(
    (gp: Gamepad) => {
      const cards = getGameCards();
      gameCardsRef.current = cards;

      if (cards.length === 0) return;

      // Left/Right - navigate between games
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('games-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('games-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('games-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('games-stick-right'));

      if (leftPressed) {
        const newIndex = Math.max(0, focusedGameIndex - 1);
        if (newIndex !== focusedGameIndex) {
          navigateToGame(newIndex);
        }
      }

      if (rightPressed) {
        const newIndex = Math.min(cards.length - 1, focusedGameIndex + 1);
        if (newIndex !== focusedGameIndex) {
          navigateToGame(newIndex);
        }
      }

      // Up - go to header
      const upPressed =
        (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('games-up')) ||
        (gp.axes[AXIS.LEFT_Y] < -DEADZONE && canInput('games-stick-up'));

      if (upPressed) {
        playNavigateSound();
        setNavigationArea('header');
      }

      // Down - switch to main content scrolling
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('games-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('games-stick-down'));

      if (downPressed) {
        playNavigateSound();
        setNavigationArea('main-content');
      }

      // A button - select current game
      if (gp.buttons[BUTTON.A]?.pressed && canInput('button-a')) {
        selectCurrentGame();
      }
    },
    [
      canInput,
      focusedGameIndex,
      getGameCards,
      navigateToGame,
      selectCurrentGame,
      setNavigationArea,
    ]
  );

  // Main gamepad polling effect
  useEffect(() => {
    if (!enabled) return;

    // Find first connected gamepad
    const gp = Object.values(gamepads).find((g) => g?.connected);
    if (!gp) return;

    // Check for modal
    const modalOpen = !!document.querySelector('[role="dialog"]');

    // Track modal open/close for focus restoration
    if (modalOpen && !wasModalOpenRef.current) {
      // Modal just opened - save currently focused element
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    } else if (!modalOpen && wasModalOpenRef.current) {
      // Modal just closed - restore focus
      if (previouslyFocusedRef.current && document.body.contains(previouslyFocusedRef.current)) {
        previouslyFocusedRef.current.focus();
      } else {
        // If previous element is gone, focus the primary action button
        const primaryButton = document.querySelector<HTMLElement>('[data-gamepad-primary-action]');
        if (primaryButton) {
          primaryButton.focus();
        }
      }
      previouslyFocusedRef.current = null;
    }
    wasModalOpenRef.current = modalOpen;

    if (modalOpen) {
      handleModalNavigation(gp);
      // Update button states at end of frame
      updatePrevButtonStates(gp);
      return;
    }

    // Handle navigation based on current area
    if (navigationArea === 'header') {
      handleHeaderNavigation(gp);
    } else if (navigationArea === 'games') {
      handleGamesNavigation(gp);
    } else if (navigationArea === 'main-content') {
      handleMainContentNavigation(gp);
    }

    // Track previous area for "just entered" detection
    prevNavigationAreaRef.current = navigationArea;

    // Update button states at end of frame
    updatePrevButtonStates(gp);
  }, [
    enabled,
    gamepads,
    navigationArea,
    handleHeaderNavigation,
    handleGamesNavigation,
    handleMainContentNavigation,
    handleModalNavigation,
    updatePrevButtonStates,
  ]);

  // Initial focus on first game card when entering gamepad mode
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      const cards = getGameCards();
      if (cards.length > 0 && focusedGameIndex < cards.length) {
        cards[focusedGameIndex].focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [enabled, focusedGameIndex, getGameCards]);

  // Update total games count when cards change
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver(() => {
      const cards = getGameCards();
      if (cards.length !== totalGames) {
        useGamepadModeStore.getState().setTotalGames(cards.length);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [enabled, getGameCards, totalGames]);
}
