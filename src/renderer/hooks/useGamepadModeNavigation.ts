import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';
import {
  playBackSound,
  playConfirmSound,
  playNavigateSound,
} from '../utils/gamepadSounds';
import { isValidGamepad } from '../utils/isValidGamepad';

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

/**
 * Gamepad navigation hook for gamepad mode
 * - Left/Right: Navigate between game cards
 * - Up/Down: Scroll main content
 * - A: Select game / Confirm in modal
 * - B: Back / Cancel in modal
 */
export function useGamepadModeNavigation(enabled = true) {
  const navigate = useNavigate();
  const lastInputRef = useRef<Record<string, number>>({});

  const focusedGameIndex = useGamepadModeStore((s) => s.focusedGameIndex);
  const setFocusedGameIndex = useGamepadModeStore((s) => s.setFocusedGameIndex);
  const navigationArea = useGamepadModeStore((s) => s.navigationArea);
  const setNavigationArea = useGamepadModeStore((s) => s.setNavigationArea);
  const totalGames = useGamepadModeStore((s) => s.totalGames);
  const selectedGame = useStore((s) => s.selectedGame);
  const setSelectedGame = useStore((s) => s.setSelectedGame);

  const prevNavigationAreaRef = useRef<string | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef<boolean>(false);
  const prevButtonStatesRef = useRef<boolean[]>([]);
  const ignoreScrollDownRef = useRef<boolean>(false);

  // Input debouncing
  const canInput = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastTime = lastInputRef.current[key] || 0;
    if (now - lastTime < INPUT_DELAY) {
      return false;
    }
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
    prevButtonStatesRef.current = gp.buttons.map((b) => b?.pressed ?? false);
  }, []);

  // Стрічка ігор віртуалізована (@tanstack/react-virtual): у DOM лише видимі
  // картки, тому позиція в NodeList ≠ індекс гри. Шукаємо за data-gamepad-index
  // на обгортці, а загальну кількість читаємо з data-gamepad-total контейнера.
  const getCardByIndex = useCallback(
    (index: number): HTMLElement | null =>
      document.querySelector<HTMLElement>(
        `[data-gamepad-game-list] [data-gamepad-index="${index}"] [data-gamepad-card]`
      ),
    []
  );

  const getTotalGameCards = useCallback((): number => {
    const container = document.querySelector<HTMLElement>('[data-gamepad-game-list]');
    return Number(container?.getAttribute('data-gamepad-total') ?? 0);
  }, []);

  // Scroll card into view
  const scrollCardIntoView = useCallback((card: HTMLElement) => {
    const container = document.querySelector('[data-gamepad-game-list]');
    if (!container) {
      return;
    }

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
      const total = getTotalGameCards();
      if (total === 0 || index < 0 || index >= total) {
        return;
      }

      setFocusedGameIndex(index);
      playNavigateSound();

      const tryFocus = (attempts: number) => {
        const card = getCardByIndex(index);
        if (card) {
          card.focus();
          scrollCardIntoView(card);
          return;
        }
        if (attempts >= 15) {
          return;
        }
        useGamepadModeStore.getState().scrollGameListToIndex?.(index);
        requestAnimationFrame(() => tryFocus(attempts + 1));
      };
      tryFocus(0);
    },
    [getCardByIndex, getTotalGameCards, setFocusedGameIndex, scrollCardIntoView]
  );

  // Refocus поточної картки з клампом (індекс може бути застарілим після фільтрів)
  const refocusCurrentCard = useCallback(() => {
    const total = getTotalGameCards();
    if (total === 0) {
      return;
    }
    getCardByIndex(Math.min(focusedGameIndex, total - 1))?.focus();
  }, [getCardByIndex, getTotalGameCards, focusedGameIndex]);

  // Select current game
  const selectCurrentGame = useCallback(() => {
    const total = getTotalGameCards();
    const index = Math.min(focusedGameIndex, total - 1);
    const card = getCardByIndex(index);
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
  }, [getCardByIndex, getTotalGameCards, focusedGameIndex, setNavigationArea]);

  // Scroll main content
  const scrollMainContent = useCallback((direction: 'up' | 'down') => {
    const mainContent = document.querySelector('[data-gamepad-main-content]');
    if (!mainContent) {
      return;
    }

    mainContent.scrollBy({
      top: direction === 'up' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  }, []);

  // Check if element is a text input (not checkbox/radio)
  const isTextInput = useCallback((el: HTMLElement): boolean => {
    if (el.tagName === 'TEXTAREA') {
      return true;
    }
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type?.toLowerCase();
      return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
    }
    return false;
  }, []);

  // Set gamepad-selected attribute on element (visual selection without focus)
  const setGamepadSelected = useCallback((el: HTMLElement | null) => {
    // Clear previous selection
    document.querySelectorAll('[data-gamepad-selected]').forEach((e) => {
      e.removeAttribute('data-gamepad-selected');
    });
    if (el) {
      el.setAttribute('data-gamepad-selected', 'true');
      el.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  // Get currently selected element (either focused or gamepad-selected)
  const getSelectedElement = useCallback(
    (elements: HTMLElement[]): { element: HTMLElement | null; index: number } => {
      // First check for actual focus
      const focused = document.activeElement as HTMLElement;
      const focusedIndex = elements.indexOf(focused);
      if (focusedIndex !== -1) {
        return { element: focused, index: focusedIndex };
      }

      // Then check for gamepad-selected
      const selected = document.querySelector<HTMLElement>('[data-gamepad-selected]');
      if (selected) {
        const selectedIndex = elements.indexOf(selected);
        if (selectedIndex !== -1) {
          return { element: selected, index: selectedIndex };
        }
      }

      return { element: null, index: -1 };
    },
    []
  );

  // Handle modal navigation
  const handleModalNavigation = useCallback(
    (gp: Gamepad) => {
      // Get the last (topmost) dialog in case of nested modals
      const modals = document.querySelectorAll('[role="dialog"]');
      const modal = modals[modals.length - 1];
      if (!modal) {
        return;
      }

      // Get all focusable elements in modal
      const allFocusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-gamepad-modal-item]:not([disabled])'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }
        // Skip elements marked as skip
        if (el.hasAttribute('data-gamepad-skip')) {
          return false;
        }
        // Exclude small X close button in Modal component's header (button in border-b with only SVG child)
        if (el.tagName === 'BUTTON' && el.closest('.border-b')) {
          const children = el.children;
          if (children.length === 1 && children[0].tagName.toLowerCase() === 'svg') {
            return false;
          }
        }
        return true;
      });

      // Sort: inputs/checkboxes first (in DOM order), then buttons in DOM order
      const focusableElements = [...allFocusable].sort((a, b) => {
        const aIsInput =
          a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA';
        const bIsInput =
          b.tagName === 'INPUT' || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA';

        // Inputs/checkboxes come first
        if (aIsInput && !bIsInput) {
          return -1;
        }
        if (!aIsInput && bIsInput) {
          return 1;
        }

        // Keep DOM order for buttons
        return 0;
      });

      if (focusableElements.length === 0) {
        return;
      }

      const { element: currentElement, index: currentIndex } =
        getSelectedElement(focusableElements);
      const activeElement = document.activeElement as HTMLElement;
      const isInputActive =
        isTextInput(activeElement) && focusableElements.includes(activeElement);

      // If nothing selected in modal, select first element
      if (currentIndex === -1) {
        const firstEl = focusableElements[0];
        if (isTextInput(firstEl)) {
          setGamepadSelected(firstEl);
        } else {
          firstEl.focus();
        }
        return;
      }

      // B button - if input is focused, blur it and immediately close the modal.
      // This combines two levels into one press:
      // 1st B = Gamescope closes its on-screen keyboard (app doesn't see it)
      // 2nd B = blur input + close modal
      // Use pressed (not justPressed) because Steam Deck keyboard consumes
      // the first B press to close itself.
      if (isInputActive && gp.buttons[BUTTON.B]?.pressed && canInput('modal-button-b')) {
        playBackSound();
        activeElement.blur();
        // Immediately close the modal after blurring (combine two actions into one B press)
        const cancelButton = modal.querySelector<HTMLButtonElement>(
          '[data-gamepad-cancel]'
        );
        if (cancelButton) {
          cancelButton.click();
        }
        return;
      }

      // B button - cancel/close modal (no input focused)
      if (gp.buttons[BUTTON.B]?.pressed && canInput('modal-button-b')) {
        const cancelButton = modal.querySelector<HTMLButtonElement>(
          '[data-gamepad-cancel]'
        );
        if (cancelButton) {
          playBackSound();
          cancelButton.click();
        }
        return;
      }

      // If text input is actively focused, don't handle navigation (let user type)
      if (isInputActive) {
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

      // Navigate to element (use selection for text inputs, focus for others)
      const navigateToElement = (el: HTMLElement) => {
        if (isTextInput(el)) {
          // For text inputs, use visual selection instead of focus
          (document.activeElement as HTMLElement)?.blur?.();
          setGamepadSelected(el);
        } else {
          // For buttons and other elements, use regular focus
          setGamepadSelected(null);
          el.focus();
        }
        playNavigateSound();
      };

      if (upPressed) {
        const nextIndex =
          currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        navigateToElement(focusableElements[nextIndex]);
      }

      if (downPressed) {
        const nextIndex =
          currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        navigateToElement(focusableElements[nextIndex]);
      }

      // Left/Right for switching between cancel/confirm buttons
      if (leftPressed && currentIndex > 0) {
        navigateToElement(focusableElements[currentIndex - 1]);
      }

      if (rightPressed && currentIndex < focusableElements.length - 1) {
        navigateToElement(focusableElements[currentIndex + 1]);
      }

      // A button - confirm/click (only on button press, not hold)
      if (isButtonJustPressed(gp, BUTTON.A) && canInput('modal-button-a')) {
        if (currentElement) {
          if (
            isTextInput(currentElement) &&
            !focusableElements.includes(document.activeElement as HTMLElement)
          ) {
            // Text input is selected but not focused - activate it
            playConfirmSound();
            setGamepadSelected(null);
            currentElement.focus();
          } else {
            // Regular element - click it
            playConfirmSound();
            currentElement.click();
          }
        }
      }
    },
    [canInput, isButtonJustPressed, isTextInput, setGamepadSelected, getSelectedElement]
  );

  // Get action buttons from MainContent
  const getActionButtons = useCallback((): HTMLElement[] => {
    const buttons = document.querySelectorAll<HTMLElement>(
      '[data-gamepad-action]:not([disabled])'
    );
    return Array.from(buttons);
  }, []);

  // Get home active cards and action buttons
  const getHomeActive = useCallback((): HTMLElement[] => {
    const allElements = document.querySelectorAll<HTMLElement>(
      '[data-gamepad-main-content] .main-page:not([style*="display: none"]) :is([data-gamepad-action], [data-gamepad-card]):not([disabled])'
    );
    return Array.from(allElements);
  }, []);

  // Go to home page (reset selected game and navigate to games area)
  const handleGoHome = useCallback(() => {
    // Check if we're already on the home page
    if (navigationArea === 'main-content' && !selectedGame) {
      return;
    }

    playNavigateSound();
    // Очищаємо selectedGame перед навігацією для миттєвого оновлення UI
    setSelectedGame(null);
    // Навігуємо на головну сторінку
    navigate('/');
    setNavigationArea('main-content');
  }, [navigationArea, selectedGame, setSelectedGame, navigate, setNavigationArea]);

  // Handle main content navigation
  const handleMainContentNavigation = useCallback(
    (gp: Gamepad) => {
      const actionButtons = selectedGame ? getActionButtons() : getHomeActive();

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
        refocusCurrentCard();
        return;
      }

      if (!gp.buttons[BUTTON.DPAD_DOWN]?.pressed) {
        ignoreScrollDownRef.current = false;
      }
      if (ignoreScrollDownRef.current) {
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
      if (isButtonJustPressed(gp, BUTTON.A) && canInput('button-a')) {
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

      // Y button - go to home page
      if (isButtonJustPressed(gp, BUTTON.Y) && canInput('button-y-home')) {
        handleGoHome();
      }
    },
    [
      canInput,
      isButtonJustPressed,
      focusedGameIndex,
      getActionButtons,
      refocusCurrentCard,
      scrollMainContent,
      setNavigationArea,
      getHomeActive,
      selectedGame,
      handleGoHome,
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
    if (!dropdown) {
      return [];
    }
    const items = dropdown.querySelectorAll<HTMLElement>('[data-gamepad-dropdown-item]');
    return Array.from(items);
  }, []);

  // Check if dropdown is open
  const isDropdownOpen = useCallback(
    (): boolean => !!document.querySelector('[data-gamepad-dropdown]'),
    []
  );

  // Get current selected/focused element in header context
  const getHeaderSelectedElement = useCallback(
    (items: HTMLElement[]): { element: HTMLElement | null; index: number } => {
      // Check for actual focus
      const focused = document.activeElement as HTMLElement;
      const focusedIndex = items.findIndex(
        (item) => item.contains(focused) || item === focused
      );
      if (focusedIndex !== -1) {
        return { element: focused, index: focusedIndex };
      }

      // Check for gamepad-selected
      const selected = document.querySelector<HTMLElement>('[data-gamepad-selected]');
      if (selected) {
        const selectedIndex = items.findIndex(
          (item) => item.contains(selected) || item === selected
        );
        if (selectedIndex !== -1) {
          return { element: selected, index: selectedIndex };
        }
      }

      return { element: null, index: -1 };
    },
    []
  );

  // Handle header navigation
  const handleHeaderNavigation = useCallback(
    (gp: Gamepad) => {
      const activeElement = document.activeElement as HTMLElement;
      const isInputActive = isTextInput(activeElement);

      // B button - if input is focused, blur it and immediately perform the next
      // back action (close dropdown or return to games). This combines two levels
      // into one press, so the user needs only 2 B presses total in Gaming Mode:
      // 1st B = Gamescope closes its on-screen keyboard (app doesn't see it)
      // 2nd B = blur input + close dropdown / return to games
      // (use pressed instead of justPressed because Steam Deck keyboard
      // consumes the first B press to close itself)
      if (isInputActive && gp.buttons[BUTTON.B]?.pressed && canInput('input-blur-b')) {
        playBackSound();
        activeElement.blur();
        // After blurring, immediately perform the next back action
        if (isDropdownOpen()) {
          // Close dropdown
          const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          document.body.dispatchEvent(event);
        } else {
          // Return to games area
          setGamepadSelected(null);
          setNavigationArea('games');
          refocusCurrentCard();
        }
        return;
      }

      // B button - handle other cases (only on button press, not hold)
      if (isButtonJustPressed(gp, BUTTON.B) && canInput('button-b')) {
        // If dropdown is open, close it
        if (isDropdownOpen()) {
          playBackSound();
          const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          document.body.dispatchEvent(event);
          return;
        }

        // Go to games
        playBackSound();
        setGamepadSelected(null);
        setNavigationArea('games');
        refocusCurrentCard();
        return;
      }

      // If text input is actively focused, don't handle navigation (let user type)
      if (isInputActive) {
        return;
      }

      // Check if dropdown is open - handle dropdown navigation
      if (isDropdownOpen()) {
        const dropdownItems = getDropdownItems();
        if (dropdownItems.length === 0) {
          return;
        }

        const currentFocused = document.activeElement as HTMLElement;
        // Check if the focused element is inside a dropdown item (e.g., input inside search container)
        let currentIndex = dropdownItems.indexOf(currentFocused);
        if (currentIndex === -1) {
          currentIndex = dropdownItems.findIndex((item) => item.contains(currentFocused));
        }

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

        // A button - select item or activate input
        if (isButtonJustPressed(gp, BUTTON.A) && canInput('button-a')) {
          const focused = document.activeElement as HTMLElement;
          if (focused && dropdownItems.includes(focused)) {
            // Check if this dropdown item contains an input
            const innerInput = focused.querySelector<HTMLInputElement>('input, textarea');
            if (innerInput) {
              // Focus the input inside
              playConfirmSound();
              innerInput.focus();
            } else {
              playConfirmSound();
              focused.click();
            }
          }
        }

        return;
      }

      // Normal header navigation
      const items = getHeaderItems();
      if (items.length === 0) {
        return;
      }

      const { element: currentElement, index: currentIndex } =
        getHeaderSelectedElement(items);

      // If nothing focused/selected, select first item
      if (currentIndex === -1) {
        const firstItem = items[0];
        const firstTarget = firstItem.querySelector<HTMLElement>(
          'input, button, [tabindex]'
        );
        const targetEl = firstTarget || firstItem;
        if (isTextInput(targetEl)) {
          setGamepadSelected(targetEl);
        } else {
          targetEl.focus();
        }
        return;
      }

      // Navigate to header item (use selection for text inputs, focus for others)
      const navigateToHeaderItem = (item: HTMLElement) => {
        const focusTarget = item.querySelector<HTMLElement>('input, button, [tabindex]');
        const targetEl = focusTarget || item;
        if (isTextInput(targetEl)) {
          (document.activeElement as HTMLElement)?.blur?.();
          setGamepadSelected(targetEl);
        } else {
          setGamepadSelected(null);
          targetEl.focus();
        }
        playNavigateSound();
      };

      // Left/Right - navigate between items
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('header-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('header-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('header-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('header-stick-right'));

      if (leftPressed && currentIndex > 0) {
        navigateToHeaderItem(items[currentIndex - 1]);
      }

      if (rightPressed && currentIndex < items.length - 1) {
        navigateToHeaderItem(items[currentIndex + 1]);
      }

      // Down - go to games
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('nav-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('nav-stick-down'));

      if (downPressed) {
        playNavigateSound();
        setGamepadSelected(null);
        setNavigationArea('games');
        refocusCurrentCard();
      }

      // A button - activate element
      if (isButtonJustPressed(gp, BUTTON.A) && canInput('button-a')) {
        if (currentElement) {
          if (isTextInput(currentElement) && currentElement !== document.activeElement) {
            // Text input is selected but not focused - activate it
            playConfirmSound();
            setGamepadSelected(null);
            currentElement.focus();
          } else {
            // Regular element - click it
            playConfirmSound();
            currentElement.click();
          }
        }
      }

      // Y button - go to home page
      if (isButtonJustPressed(gp, BUTTON.Y) && canInput('button-y-home')) {
        handleGoHome();
      }
    },
    [
      canInput,
      isButtonJustPressed,
      focusedGameIndex,
      refocusCurrentCard,
      getHeaderItems,
      getDropdownItems,
      isDropdownOpen,
      setNavigationArea,
      isTextInput,
      setGamepadSelected,
      getHeaderSelectedElement,
      handleGoHome,
    ]
  );

  // Handle games navigation
  const handleGamesNavigation = useCallback(
    (gp: Gamepad) => {
      const totalCards = getTotalGameCards();
      if (totalCards === 0) {
        return;
      }

      // Left/Right - navigate between games
      const leftPressed =
        (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('games-left')) ||
        (gp.axes[AXIS.LEFT_X] < -DEADZONE && canInput('games-stick-left'));
      const rightPressed =
        (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('games-right')) ||
        (gp.axes[AXIS.LEFT_X] > DEADZONE && canInput('games-stick-right'));

      // Індекс міг лишитись поза межами після звуження списку фільтром —
      // клампимо, інакше left/A мовчки впираються в bounds check navigateToGame
      const currentIndex = Math.min(focusedGameIndex, totalCards - 1);

      if (leftPressed) {
        const newIndex = Math.max(0, currentIndex - 1);
        if (newIndex !== focusedGameIndex) {
          navigateToGame(newIndex);
        }
      }

      if (rightPressed) {
        const newIndex = Math.min(totalCards - 1, currentIndex + 1);
        if (newIndex !== focusedGameIndex) {
          navigateToGame(newIndex);
        }
      }

      // Up - go to header
      const upPressed =
        (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('nav-up')) ||
        (gp.axes[AXIS.LEFT_Y] < -DEADZONE && canInput('nav-stick-up'));

      if (upPressed) {
        playNavigateSound();
        setNavigationArea('header');
      }

      // Down - switch to main content scrolling
      const downPressed =
        (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('nav-down')) ||
        (gp.axes[AXIS.LEFT_Y] > DEADZONE && canInput('nav-stick-down'));

      if (downPressed) {
        playNavigateSound();
        setNavigationArea('main-content');
        ignoreScrollDownRef.current = true;
      }

      // A button - select current game
      if (gp.buttons[BUTTON.A]?.pressed && canInput('button-a')) {
        selectCurrentGame();
      }

      // Y button - go to home page (only when game is selected)
      if (gp.buttons[BUTTON.Y]?.pressed && canInput('button-y-home')) {
        handleGoHome();
      }
    },
    [
      canInput,
      focusedGameIndex,
      getTotalGameCards,
      navigateToGame,
      selectCurrentGame,
      setNavigationArea,
      handleGoHome,
    ]
  );

  // Clear gamepad-selected when navigation area changes
  useEffect(() => {
    if (
      prevNavigationAreaRef.current !== null &&
      prevNavigationAreaRef.current !== navigationArea
    ) {
      // Clear gamepad-selected when switching areas
      document.querySelectorAll('[data-gamepad-selected]').forEach((e) => {
        e.removeAttribute('data-gamepad-selected');
      });
    }
  }, [navigationArea]);

  // Latest handlers proxied through a ref so the RAF loop below always sees
  // the current closures without having to depend on them. Pattern borrowed
  // from React Three Fiber's useFrame: input lives outside React state,
  // re-renders happen only when a handler actually mutates the store.
  const handlersRef = useRef({
    modal: handleModalNavigation,
    header: handleHeaderNavigation,
    games: handleGamesNavigation,
    mainContent: handleMainContentNavigation,
    updatePrevButtons: updatePrevButtonStates,
  });
  useEffect(() => {
    handlersRef.current = {
      modal: handleModalNavigation,
      header: handleHeaderNavigation,
      games: handleGamesNavigation,
      mainContent: handleMainContentNavigation,
      updatePrevButtons: updatePrevButtonStates,
    };
  });

  // Main gamepad polling loop. Runs at requestAnimationFrame cadence but
  // does NOT touch React state, so an idle gamepad costs zero re-renders.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let rafId = 0;

    const tick = () => {
      const pads = navigator.getGamepads();
      let gp: Gamepad | null = null;
      for (const pad of pads) {
        if (pad && pad.connected && isValidGamepad(pad)) {
          gp = pad;
          break;
        }
      }

      if (!gp) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const modalOpen = !!document.querySelector('[role="dialog"]');

      // Track modal open/close for focus restoration
      if (modalOpen && !wasModalOpenRef.current) {
        // Modal just opened - save currently focused element and clear selection
        previouslyFocusedRef.current = document.activeElement as HTMLElement;
        document.querySelectorAll('[data-gamepad-selected]').forEach((e) => {
          e.removeAttribute('data-gamepad-selected');
        });
      } else if (!modalOpen && wasModalOpenRef.current) {
        // Modal just closed - restore focus and clear any modal selection
        document.querySelectorAll('[data-gamepad-selected]').forEach((e) => {
          e.removeAttribute('data-gamepad-selected');
        });
        if (
          previouslyFocusedRef.current &&
          document.body.contains(previouslyFocusedRef.current)
        ) {
          previouslyFocusedRef.current.focus();
        } else {
          // If previous element is gone, focus the primary action button
          const primaryButton = document.querySelector<HTMLElement>(
            '[data-gamepad-primary-action]'
          );
          if (primaryButton) {
            primaryButton.focus();
          }
        }
        previouslyFocusedRef.current = null;
      }
      wasModalOpenRef.current = modalOpen;

      const handlers = handlersRef.current;

      if (modalOpen) {
        handlers.modal(gp);
      } else {
        const area = useGamepadModeStore.getState().navigationArea;
        if (area === 'header') {
          handlers.header(gp);
        } else if (area === 'games') {
          handlers.games(gp);
        } else if (area === 'main-content') {
          handlers.mainContent(gp);
        }
        prevNavigationAreaRef.current = area;
      }

      handlers.updatePrevButtons(gp);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  // Initial focus on the first game card when entering gamepad mode — as soon as
  // the cards are in the DOM (retry per animation frame instead of a fixed delay).
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let rafId = 0;
    let attempts = 0;
    const focusFirstCard = () => {
      const card = getCardByIndex(focusedGameIndex);
      if (card) {
        card.focus();
      } else if (attempts++ < 30) {
        rafId = requestAnimationFrame(focusFirstCard);
      }
    };
    rafId = requestAnimationFrame(focusFirstCard);

    return () => cancelAnimationFrame(rafId);
  }, [enabled, focusedGameIndex, getCardByIndex]);

  // Update total games count when the list composition changes.
  // Спостерігаємо лише за атрибутом data-gamepad-total (childList на body
  // спрацьовував би на кожен чурн віртуалізатора); початкове значення
  // синкаємо одразу, бо вставка контейнера не генерує attribute-мутації.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const sync = () => {
      const total = getTotalGameCards();
      if (total !== totalGames) {
        useGamepadModeStore.getState().setTotalGames(total);
      }
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-gamepad-total'],
    });

    return () => observer.disconnect();
  }, [enabled, getTotalGameCards, totalGames]);
}
