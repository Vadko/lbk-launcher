import { useEffect, useRef, useCallback } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

// Audio context for sound effects
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a navigation sound effect (subtle tick)
 */
function playNavigateSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.06);
  } catch {
    // Audio not available
  }
}

/**
 * Play a confirm sound effect (positive blip)
 */
function playConfirmSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio not available
  }
}

/**
 * Play a back/cancel sound effect (lower tone)
 */
function playBackSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(500, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

// Steam Deck / Standard gamepad button mapping
const BUTTON = {
  A: 0,
  B: 1,
  LB: 4,
  RB: 5,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
};

const DEADZONE = 0.5;
const INPUT_DELAY = 150;

// CSS class for gamepad focus styling
const FOCUS_CLASS = 'gamepad-focus';

/**
 * Add focus indicator element to the DOM
 */
function createFocusIndicator(): HTMLDivElement {
  const existing = document.getElementById('gamepad-focus-indicator');
  if (existing) return existing as HTMLDivElement;

  const indicator = document.createElement('div');
  indicator.id = 'gamepad-focus-indicator';
  indicator.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    border-radius: 12px;
    opacity: 0;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 0 0 2px rgba(0, 242, 255, 0.8),
      0 0 20px rgba(0, 242, 255, 0.4),
      0 0 40px rgba(0, 242, 255, 0.2),
      inset 0 0 20px rgba(0, 242, 255, 0.1);
    background: linear-gradient(135deg, rgba(0, 242, 255, 0.05), rgba(189, 0, 255, 0.05));
  `;
  document.body.appendChild(indicator);
  return indicator;
}

/**
 * Check if element is inside a popup/dropdown
 */
function isInsidePopup(element: HTMLElement): boolean {
  let parent: HTMLElement | null = element;
  while (parent) {
    // Check for common popup indicators
    if (parent.classList.contains('filter-dropdown') ||
        parent.getAttribute('role') === 'menu' ||
        parent.getAttribute('role') === 'dialog' ||
        parent.classList.contains('modal') ||
        parent.hasAttribute('data-popup')) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Update focus indicator position and size
 */
function updateFocusIndicator(element: HTMLElement | null): void {
  const indicator = document.getElementById('gamepad-focus-indicator');
  if (!indicator) return;

  if (!element) {
    indicator.style.opacity = '0';
    return;
  }

  // If element is inside a popup, don't show the external indicator
  // The element will have its own focus styles
  if (isInsidePopup(element)) {
    indicator.style.opacity = '0';
    return;
  }

  const rect = element.getBoundingClientRect();
  const padding = 4;

  indicator.style.left = `${rect.left - padding}px`;
  indicator.style.top = `${rect.top - padding}px`;
  indicator.style.width = `${rect.width + padding * 2}px`;
  indicator.style.height = `${rect.height + padding * 2}px`;
  indicator.style.opacity = '1';

  // Match border radius of element
  const computedStyle = window.getComputedStyle(element);
  indicator.style.borderRadius = computedStyle.borderRadius || '12px';
}

/**
 * Get all visible focusable elements
 */
function getFocusableElements(): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    '[tabindex="0"]',
    '[role="button"]',
    '[data-focusable]',
  ].join(', ');

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  });
}

/**
 * Calculate distance score between two elements
 */
function getDirectionalScore(
  fromRect: DOMRect,
  toRect: DOMRect,
  direction: Direction
): number | null {
  const fromCx = fromRect.left + fromRect.width / 2;
  const fromCy = fromRect.top + fromRect.height / 2;
  const toCx = toRect.left + toRect.width / 2;
  const toCy = toRect.top + toRect.height / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  // Check if element is in the correct direction with smaller threshold
  const threshold = 5;
  let isValid = false;
  let primaryDistance = 0;
  let secondaryDistance = 0;

  switch (direction) {
    case 'up':
      isValid = dy < -threshold;
      primaryDistance = Math.abs(dy);
      secondaryDistance = Math.abs(dx);
      break;
    case 'down':
      isValid = dy > threshold;
      primaryDistance = Math.abs(dy);
      secondaryDistance = Math.abs(dx);
      break;
    case 'left':
      isValid = dx < -threshold;
      primaryDistance = Math.abs(dx);
      secondaryDistance = Math.abs(dy);
      break;
    case 'right':
      isValid = dx > threshold;
      primaryDistance = Math.abs(dx);
      secondaryDistance = Math.abs(dy);
      break;
  }

  if (!isValid) return null;

  // For horizontal navigation (left/right), be more lenient with vertical offset
  // This helps navigate between sidebar and main content
  const secondaryWeight = (direction === 'left' || direction === 'right') ? 1.5 : 2.5;

  // Weighted score: primary direction matters more
  return primaryDistance + secondaryDistance * secondaryWeight;
}

/**
 * Find the main scrollable container for an element
 */
function findScrollableContainer(element: HTMLElement): HTMLElement | null {
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const hasScroll = parent.scrollHeight > parent.clientHeight;

    if ((overflowY === 'auto' || overflowY === 'scroll' ||
        parent.classList.contains('custom-scrollbar') ||
        parent.classList.contains('overflow-y-auto')) && hasScroll) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Check if element can scroll in the given direction
 */
function canScrollInDirection(container: HTMLElement, direction: 'up' | 'down'): boolean {
  if (direction === 'down') {
    return container.scrollTop < container.scrollHeight - container.clientHeight - 10;
  } else {
    return container.scrollTop > 10;
  }
}

/**
 * Navigate to the next element in a direction with animation
 */
function navigateDirection(direction: Direction): void {
  const elements = getFocusableElements();
  const current = document.activeElement as HTMLElement | null;

  if (elements.length === 0) return;

  // Focus first element if nothing is focused
  if (!current || !elements.includes(current)) {
    const firstElement = elements[0];
    if (firstElement) {
      focusElement(firstElement);
    }
    return;
  }

  const currentRect = current.getBoundingClientRect();

  // Find the scrollable container of current element
  const currentContainer = findScrollableContainer(current);

  // Find elements in the same container first (for up/down navigation)
  let bestElement: HTMLElement | null = null;
  let bestScore = Infinity;
  let bestSameContainer: HTMLElement | null = null;
  let bestSameContainerScore = Infinity;

  for (const el of elements) {
    if (el === current) continue;

    const rect = el.getBoundingClientRect();
    const score = getDirectionalScore(currentRect, rect, direction);

    if (score !== null) {
      // Check if element is in the same scrollable container
      const elContainer = findScrollableContainer(el);
      const sameContainer = currentContainer && elContainer === currentContainer;

      if (sameContainer && score < bestSameContainerScore) {
        bestSameContainerScore = score;
        bestSameContainer = el;
      }

      if (score < bestScore) {
        bestScore = score;
        bestElement = el;
      }
    }
  }

  // For vertical navigation (up/down), prefer elements in the same container
  if (direction === 'up' || direction === 'down') {
    if (bestSameContainer) {
      focusElement(bestSameContainer);
      return;
    }

    // If no element in same container but we can scroll, do scroll instead
    if (currentContainer && canScrollInDirection(currentContainer, direction)) {
      currentContainer.scrollBy({
        top: direction === 'up' ? -150 : 150,
        behavior: 'smooth'
      });
      // Update indicator position after scroll
      setTimeout(() => updateFocusIndicator(current), 250);
      playNavigateSound();
      return;
    }
  }

  // For horizontal or when no same-container element found, use best overall
  if (bestElement) {
    focusElement(bestElement);
  }
}

/**
 * Scroll element into view within its scrollable parent
 */
function scrollIntoViewIfNeeded(element: HTMLElement): void {
  // Find the scrollable parent
  let scrollParent: HTMLElement | null = element.parentElement;
  while (scrollParent) {
    const style = window.getComputedStyle(scrollParent);
    const overflowY = style.overflowY;
    const hasScroll = scrollParent.scrollHeight > scrollParent.clientHeight;

    if ((overflowY === 'auto' || overflowY === 'scroll' ||
        scrollParent.classList.contains('custom-scrollbar') ||
        scrollParent.classList.contains('overflow-y-auto')) && hasScroll) {
      break;
    }
    scrollParent = scrollParent.parentElement;
  }

  if (!scrollParent) return;

  const parentRect = scrollParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Calculate visible area with padding
  const topThreshold = parentRect.top + 80;
  const bottomThreshold = parentRect.bottom - 80;

  // Check if element is above visible area
  if (elementRect.top < topThreshold) {
    const scrollAmount = elementRect.top - topThreshold;
    scrollParent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }
  // Check if element is below visible area
  else if (elementRect.bottom > bottomThreshold) {
    const scrollAmount = elementRect.bottom - bottomThreshold;
    scrollParent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }

  // Update focus indicator position after scroll
  setTimeout(() => updateFocusIndicator(element), 250);
}

/**
 * Focus element with animation and sound
 */
function focusElement(element: HTMLElement): void {
  // Remove focus class from previous element
  const previousFocused = document.querySelector(`.${FOCUS_CLASS}`);
  if (previousFocused) {
    previousFocused.classList.remove(FOCUS_CLASS);
  }

  // Add focus class to new element
  element.classList.add(FOCUS_CLASS);
  element.focus({ preventScroll: true });

  // Update focus indicator position
  updateFocusIndicator(element);

  // Scroll into view if needed (custom implementation for better control)
  scrollIntoViewIfNeeded(element);

  // Play navigation sound
  playNavigateSound();

  // Trigger a subtle haptic-like visual feedback
  element.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.02)' },
    { transform: 'scale(1)' },
  ], {
    duration: 150,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  });
}

/**
 * Handle window resize - update indicator position
 */
function handleResize(): void {
  const focused = document.querySelector(`.${FOCUS_CLASS}`) as HTMLElement | null;
  if (focused) {
    updateFocusIndicator(focused);
  }
}

export function useGamepadNavigation(enabled: boolean = true): void {
  const lastInputTimeRef = useRef<Record<string, number>>({});
  const frameRef = useRef<number>();
  const gamepadConnectedRef = useRef(false);

  const canInput = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastTime = lastInputTimeRef.current[key] || 0;
    if (now - lastTime < INPUT_DELAY) return false;
    lastInputTimeRef.current[key] = now;
    return true;
  }, []);

  const handleConfirm = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active) {
      // Play confirm sound
      playConfirmSound();

      // Visual feedback for click
      active.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.95)' },
        { transform: 'scale(1)' },
      ], {
        duration: 100,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      });
      active.click();
    }
  }, []);

  const handleBack = useCallback(() => {
    // Play back sound
    playBackSound();

    // Try to close modal or go back
    const closeBtn = document.querySelector<HTMLElement>(
      '[data-close], [aria-label*="lose"], [aria-label*="акрити"], .modal-close-btn'
    );
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }, []);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    // Find the scrollable container that contains the focused element
    const focused = document.activeElement as HTMLElement | null;
    let scrollable: Element | null = null;

    if (focused) {
      // Walk up the DOM tree to find the nearest scrollable parent
      let parent = focused.parentElement;
      while (parent) {
        if (parent.classList.contains('custom-scrollbar') ||
            parent.classList.contains('overflow-y-auto')) {
          scrollable = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    // Fallback to first scrollable container
    if (!scrollable) {
      scrollable = document.querySelector('.custom-scrollbar');
    }

    if (scrollable) {
      scrollable.scrollBy({
        top: direction === 'up' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Create focus indicator
    createFocusIndicator();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Track focus changes to update indicator
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (gamepadConnectedRef.current && target) {
        updateFocusIndicator(target);
      }
    };

    const handleFocusOut = () => {
      if (!document.activeElement || document.activeElement === document.body) {
        const indicator = document.getElementById('gamepad-focus-indicator');
        if (indicator) {
          indicator.style.opacity = '0';
        }
      }
    };

    // Hide indicator when user starts using mouse
    const handleMouseMove = () => {
      if (gamepadConnectedRef.current) {
        gamepadConnectedRef.current = false;
        const indicator = document.getElementById('gamepad-focus-indicator');
        if (indicator) {
          indicator.style.opacity = '0';
        }
        // Remove gamepad-focus class from any element
        const focused = document.querySelector(`.${FOCUS_CLASS}`);
        if (focused) {
          focused.classList.remove(FOCUS_CLASS);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    const pollGamepad = (): void => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

      if (gp) {
        if (!gamepadConnectedRef.current) {
          gamepadConnectedRef.current = true;
          // Show indicator for current focused element
          const focused = document.activeElement as HTMLElement;
          if (focused && focused !== document.body) {
            updateFocusIndicator(focused);
          }
        }

        // D-Pad navigation
        if (gp.buttons[BUTTON.DPAD_UP]?.pressed && canInput('up')) {
          navigateDirection('up');
        }
        if (gp.buttons[BUTTON.DPAD_DOWN]?.pressed && canInput('down')) {
          navigateDirection('down');
        }
        if (gp.buttons[BUTTON.DPAD_LEFT]?.pressed && canInput('left')) {
          navigateDirection('left');
        }
        if (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed && canInput('right')) {
          navigateDirection('right');
        }

        // Left stick navigation
        const lx = gp.axes[AXIS.LEFT_X] || 0;
        const ly = gp.axes[AXIS.LEFT_Y] || 0;

        if (Math.abs(lx) > DEADZONE) {
          const dir = lx > 0 ? 'right' : 'left';
          if (canInput(`stick-${dir}`)) navigateDirection(dir);
        }
        if (Math.abs(ly) > DEADZONE) {
          const dir = ly > 0 ? 'down' : 'up';
          if (canInput(`stick-${dir}`)) navigateDirection(dir);
        }

        // Action buttons
        if (gp.buttons[BUTTON.A]?.pressed && canInput('a')) {
          handleConfirm();
        }
        if (gp.buttons[BUTTON.B]?.pressed && canInput('b')) {
          handleBack();
        }

        // Shoulder buttons for scrolling
        if (gp.buttons[BUTTON.LB]?.pressed && canInput('lb')) {
          handleScroll('up');
        }
        if (gp.buttons[BUTTON.RB]?.pressed && canInput('rb')) {
          handleScroll('down');
        }
      }

      frameRef.current = requestAnimationFrame(pollGamepad);
    };

    frameRef.current = requestAnimationFrame(pollGamepad);

    const handleConnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Connected:', e.gamepad.id);
      gamepadConnectedRef.current = true;
    };

    const handleDisconnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Disconnected:', e.gamepad.id);
      gamepadConnectedRef.current = false;
      // Hide indicator when gamepad disconnects
      const indicator = document.getElementById('gamepad-focus-indicator');
      if (indicator) {
        indicator.style.opacity = '0';
      }
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);

      // Remove focus indicator
      const indicator = document.getElementById('gamepad-focus-indicator');
      if (indicator) {
        indicator.remove();
      }
    };
  }, [enabled, canInput, handleConfirm, handleBack, handleScroll]);
}
