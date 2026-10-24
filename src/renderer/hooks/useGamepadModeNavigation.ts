import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GAMEPAD_CARD_STRIDE } from '../components/Sidebar/constants';
import {
  type GamepadHintContext,
  useGamepadModeStore,
} from '../store/useGamepadModeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStore } from '../store/useStore';
import {
  playBackSound,
  playConfirmSound,
  playNavigateSound,
} from '../utils/gamepadSounds';
import { isValidGamepad } from '../utils/isValidGamepad';
import { type Direction, findNextInDirection } from '../utils/spatialNavigation';

// Standard Gamepad API mapping (Xbox layout; PlayStation reports the same indices)
const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,
  MENU: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_Y: 3,
} as const;

const STICK_DEADZONE = 0.5;
const SCROLL_STICK_DEADZONE = 0.2;
const SCROLL_STICK_SPEED = 1800;
const REPEAT_DELAY = 380;
const REPEAT_INTERVAL = 110;
const B_WHILE_TYPING_THROTTLE = 250;
const SCROLL_STEP = 320;
const PAGE_SCROLL_RATIO = 0.85;
const REVEAL_MARGIN_TOP = 24;
// Keeps the focused element clear of the floating hint bar
const REVEAL_MARGIN_BOTTOM = 96;

const MODAL_FOCUSABLE =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-gamepad-modal-item]:not([disabled])';
const MAIN_FOCUSABLE = '[data-gamepad-action], [data-gamepad-card]';
const HEADER_TARGET = 'input, button, [tabindex]';

type Area = 'header' | 'games' | 'main-content';

interface Frame {
  now: number;
  dt: number;
  gp: Gamepad;
  direction: Direction | null;
  // Any new direction or button edge this frame — idle frames skip DOM scans
  hasInput: boolean;
  pressed: (button: number) => boolean;
  held: (button: number) => boolean;
}

const isTextInput = (
  el: Element | null
): el is HTMLInputElement | HTMLTextAreaElement => {
  if (el instanceof HTMLTextAreaElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    return (
      !el.readOnly &&
      !['checkbox', 'radio', 'button', 'submit', 'reset', 'range'].includes(el.type)
    );
  }
  return false;
};

const isVisible = (el: Element) =>
  el.getClientRects().length > 0 && el.checkVisibility({ visibilityProperty: true });

const isEnabled = (el: Element) =>
  !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true';

const intersects = (el: Element, container: Element) => {
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return r.bottom > c.top + 1 && r.top < c.bottom - 1;
};

const clearSelected = () => {
  document.querySelectorAll('[data-gamepad-selected]').forEach((e) => {
    e.removeAttribute('data-gamepad-selected');
  });
};

const scrollBehavior = (): ScrollBehavior =>
  useSettingsStore.getState().animationsEnabled ? 'smooth' : 'auto';

const getTopDialog = (): HTMLElement | null => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  return dialogs[dialogs.length - 1] ?? null;
};

const getMainContent = (): HTMLElement | null => {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-gamepad-main-content]')
  ).filter(isVisible);
  return roots[roots.length - 1] ?? null;
};

const getOpenDropdown = (scope: ParentNode): HTMLElement | null =>
  scope.querySelector<HTMLElement>('[data-gamepad-dropdown]');

const getDropdownItems = (dropdown: HTMLElement) =>
  Array.from(
    dropdown.querySelectorAll<HTMLElement>('[data-gamepad-dropdown-item]')
  ).filter((el) => isEnabled(el) && isVisible(el));

const getMainCandidates = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(MAIN_FOCUSABLE)).filter(
    (el) => isEnabled(el) && isVisible(el)
  );

const getHeaderTargets = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-gamepad-header-item]'))
    .filter(isVisible)
    .map((item) =>
      item.matches(HEADER_TARGET)
        ? item
        : (item.querySelector<HTMLElement>(HEADER_TARGET) ?? item)
    );

const getModalCandidates = (modal: HTMLElement) => {
  const items = Array.from(modal.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).filter(
    (el) => {
      if (!isVisible(el) || el.hasAttribute('data-gamepad-skip')) {
        return false;
      }
      // The header's icon-only X is redundant with B and only gets in the way
      const isHeaderCloseIcon =
        el.tagName === 'BUTTON' &&
        !!el.closest('.border-b') &&
        el.children.length === 1 &&
        el.children[0].tagName.toLowerCase() === 'svg';
      return !isHeaderCloseIcon;
    }
  );
  // A drilled-into sub-list keeps navigation inside itself until B steps back out
  const drillScope = modal.querySelector('[data-gamepad-drill-back]')?.parentElement;
  return drillScope ? items.filter((el) => drillScope.contains(el)) : items;
};

const findCurrent = (items: HTMLElement[]): HTMLElement | null => {
  const active = document.activeElement;
  const selected = document.querySelector<HTMLElement>('[data-gamepad-selected]');
  return (
    items.find((el) => el === active) ??
    items.find((el) => !!active && el.contains(active)) ??
    items.find((el) => el === selected) ??
    null
  );
};

const findNext = (from: HTMLElement, items: HTMLElement[], direction: Direction) =>
  findNextInDirection(
    from.getBoundingClientRect(),
    items
      .filter((el) => el !== from)
      .map((el) => ({ item: el, box: el.getBoundingClientRect() })),
    direction
  );

const revealInContainer = (el: HTMLElement, container: HTMLElement) => {
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  const top = c.top + REVEAL_MARGIN_TOP;
  const bottom = c.bottom - REVEAL_MARGIN_BOTTOM;
  let delta = 0;
  if (r.top < top || r.height > bottom - top) {
    delta = r.top - top;
  } else if (r.bottom > bottom) {
    delta = r.bottom - bottom;
  }
  if (delta !== 0) {
    container.scrollBy({ top: delta, behavior: scrollBehavior() });
  }
};

// Text fields only get a visual selection, so the on-screen keyboard opens on A, not on pass-through
const moveFocusTo = (el: HTMLElement, revealIn?: HTMLElement | null) => {
  clearSelected();
  if (isTextInput(el)) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    el.setAttribute('data-gamepad-selected', 'true');
  } else {
    el.focus({ preventScroll: true });
  }
  if (revealIn) {
    revealInContainer(el, revealIn);
  } else {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
};

const isSearchInput = (el: Element | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'search';

// The search field the gamepad is on — typing in it or just highlighted
const getActiveSearchInput = (scope: HTMLElement | null) => {
  const candidates = [
    document.activeElement,
    document.querySelector('[data-gamepad-selected]'),
  ];
  return (
    candidates.find(
      (el): el is HTMLInputElement =>
        isSearchInput(el) && (scope ? scope.contains(el) : !el.closest('[role="dialog"]'))
    ) ?? null
  );
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
    input,
    value
  );
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

// Input swallows the first change right after an IME composition ends — retry once
const clearInput = (input: HTMLInputElement) => {
  setInputValue(input, '');
  requestAnimationFrame(() => {
    if (input.value !== '') {
      setInputValue(input, '');
    }
  });
};

const activate = (el: HTMLElement) => {
  playConfirmSound();
  if (isTextInput(el) && document.activeElement !== el) {
    clearSelected();
    el.focus();
    return;
  }
  const innerInput = el.querySelector<HTMLElement>('input, textarea');
  if (innerInput && isTextInput(innerInput)) {
    innerInput.focus();
    return;
  }
  el.click();
};

const findScrollable = (
  from: Element | null,
  within: HTMLElement
): HTMLElement | null => {
  for (let el = from; el && within.contains(el); el = el.parentElement) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return el;
      }
    }
  }
  let best: HTMLElement | null = null;
  for (const el of within.querySelectorAll<HTMLElement>('*')) {
    if (
      el.scrollHeight <= el.clientHeight + 1 ||
      (best && el.clientHeight <= best.clientHeight)
    ) {
      continue;
    }
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      best = el;
    }
  }
  return best;
};

const modalScrollFallback = new WeakMap<HTMLElement, HTMLElement>();

const getModalScrollContainer = (modal: HTMLElement): HTMLElement | null => {
  const fromFocus = findScrollable(document.activeElement, modal);
  if (fromFocus) {
    return fromFocus;
  }
  const cached = modalScrollFallback.get(modal);
  if (cached?.isConnected) {
    return cached;
  }
  const found = findScrollable(null, modal);
  if (found) {
    modalScrollFallback.set(modal, found);
  }
  return found;
};

const closeDropdown = () => {
  document.body.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })
  );
};

const getGameList = () => document.querySelector<HTMLElement>('[data-gamepad-game-list]');

const getTotalGameCards = () =>
  Number(getGameList()?.getAttribute('data-gamepad-total') ?? 0);

// The strip is virtualized, so NodeList position ≠ game index — look cards up by data-gamepad-index
const getCardByIndex = (index: number) =>
  document.querySelector<HTMLElement>(
    `[data-gamepad-game-list] [data-gamepad-index="${index}"] [data-gamepad-card]`
  );

const scrollCardIntoView = (card: HTMLElement) => {
  const container = getGameList();
  if (!container) {
    return;
  }
  const c = container.getBoundingClientRect();
  const r = card.getBoundingClientRect();
  if (r.left < c.left) {
    container.scrollBy({ left: r.left - c.left - 16, behavior: scrollBehavior() });
  } else if (r.right > c.right) {
    container.scrollBy({ left: r.right - c.right + 16, behavior: scrollBehavior() });
  }
};

// Mounts the card through the virtualizer when needed, retrying per frame
const withCard = (index: number, fn: (card: HTMLElement) => void) => {
  const attempt = (n: number) => {
    const card = getCardByIndex(index);
    if (card) {
      fn(card);
      return;
    }
    if (n >= 30) {
      return;
    }
    useGamepadModeStore.getState().scrollGameListToIndex?.(index);
    requestAnimationFrame(() => attempt(n + 1));
  };
  attempt(0);
};

const focusCard = (index: number) => {
  withCard(index, (card) => {
    card.focus({ preventScroll: true });
    scrollCardIntoView(card);
  });
};

const readDirection = (gp: Gamepad): Direction | null => {
  if (gp.buttons[BUTTON.DPAD_UP]?.pressed) {
    return 'up';
  }
  if (gp.buttons[BUTTON.DPAD_DOWN]?.pressed) {
    return 'down';
  }
  if (gp.buttons[BUTTON.DPAD_LEFT]?.pressed) {
    return 'left';
  }
  if (gp.buttons[BUTTON.DPAD_RIGHT]?.pressed) {
    return 'right';
  }
  const x = gp.axes[AXIS.LEFT_X] ?? 0;
  const y = gp.axes[AXIS.LEFT_Y] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DEADZONE) {
    return null;
  }
  if (Math.abs(x) > Math.abs(y)) {
    return x > 0 ? 'right' : 'left';
  }
  return y > 0 ? 'down' : 'up';
};

// The full button map is mirrored in GamepadHelpOverlay — keep the two in sync
export function useGamepadModeNavigation(enabled = true) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    navigateRef.current = navigate;
    pathnameRef.current = location.pathname;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const store = useGamepadModeStore.getState;
    let rafId = 0;
    let lastFrameAt = performance.now();
    let prevButtons: boolean[] = [];
    let heldDirection: Direction | null = null;
    let heldSince = 0;
    let lastRepeatAt = 0;
    let suppressDirection = false;
    let lastBWhileTyping = 0;
    let prevArea: Area | null = null;
    let wasModalOpen = false;
    let focusBeforeModal: HTMLElement | null = null;
    let dropdownTrigger: HTMLElement | null = null;
    // LB/RB onto a multi-translation card opens the picker — cancelling it must not move the strip
    let indexBeforeSwitch: { index: number; pathname: string } | null = null;

    const isHome = () => pathnameRef.current === '/';
    const isGamePage = () => pathnameRef.current.startsWith('/game/');

    const switchArea = (area: Area) => {
      suppressDirection = true;
      clearSelected();
      store().setNavigationArea(area);
    };

    const goHome = () => {
      if (isHome()) {
        if (store().navigationArea !== 'main-content') {
          playNavigateSound();
          switchArea('main-content');
        }
        return;
      }
      playNavigateSound();
      useStore.getState().setSelectedGame(null);
      navigateRef.current('/');
      switchArea('main-content');
    };

    const currentGameIndex = () =>
      Math.max(0, Math.min(store().focusedGameIndex, getTotalGameCards() - 1));

    const navigateToGame = (index: number) => {
      const total = getTotalGameCards();
      const target = Math.max(0, Math.min(index, total - 1));
      if (total === 0 || target === store().focusedGameIndex) {
        return;
      }
      store().setFocusedGameIndex(target);
      playNavigateSound();
      focusCard(target);
    };

    const openCard = (index: number, keepArea: boolean) => {
      withCard(index, (card) => {
        playConfirmSound();
        card.click();
        if (keepArea) {
          return;
        }
        // A multi-translation card opens the picker instead of navigating
        setTimeout(() => {
          if (!getTopDialog()) {
            switchArea('main-content');
          }
        }, 50);
      });
    };

    const focusSearch = () => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-gamepad-search] input'
      );
      if (!input) {
        return;
      }
      playConfirmSound();
      switchArea('header');
      input.focus();
    };

    const scrollBy = (container: HTMLElement | null, top: number) => {
      container?.scrollBy({ top, behavior: scrollBehavior() });
    };

    const handleDropdown = (f: Frame, dropdown: HTMLElement) => {
      const items = getDropdownItems(dropdown);
      const current = findCurrent(items);

      if (f.pressed(BUTTON.B)) {
        playBackSound();
        closeDropdown();
        return;
      }
      if (items.length === 0) {
        return;
      }
      if (!current) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && !dropdown.contains(active)) {
          dropdownTrigger = active;
        }
        const selected = items.find((el) =>
          el.hasAttribute('data-gamepad-dropdown-selected')
        );
        moveFocusTo(selected ?? items[0]);
        return;
      }

      if (f.direction === 'up' || f.direction === 'down') {
        const index = items.indexOf(current) + (f.direction === 'up' ? -1 : 1);
        if (index >= 0 && index < items.length) {
          moveFocusTo(items[index]);
          playNavigateSound();
        }
      }
      if (f.pressed(BUTTON.A)) {
        activate(current);
      }
    };

    const handleModal = (f: Frame, modal: HTMLElement) => {
      const dropdown = getOpenDropdown(modal);
      if (dropdown) {
        handleDropdown(f, dropdown);
        return;
      }

      const active = document.activeElement;
      const isTyping = isTextInput(active) && modal.contains(active);

      // Level-triggered B: the Steam Deck keyboard swallows the edge of the first press
      if (isTyping) {
        if (f.held(BUTTON.B) && f.now - lastBWhileTyping > B_WHILE_TYPING_THROTTLE) {
          lastBWhileTyping = f.now;
          playBackSound();
          active.blur();
          // Stay on the field: closing here would throw away whatever was typed
          active.setAttribute('data-gamepad-selected', 'true');
        }
        return;
      }

      if (f.pressed(BUTTON.B)) {
        const back =
          modal.querySelector<HTMLElement>('[data-gamepad-drill-back]') ??
          modal.querySelector<HTMLElement>('[data-gamepad-cancel]');
        if (back) {
          playBackSound();
          back.click();
        }
        return;
      }

      if (f.pressed(BUTTON.LT) || f.pressed(BUTTON.RT)) {
        const container = getModalScrollContainer(modal);
        const sign = f.pressed(BUTTON.LT) ? -1 : 1;
        scrollBy(container, sign * (container?.clientHeight ?? 0) * PAGE_SCROLL_RATIO);
      }

      const focusInside =
        modal.contains(document.activeElement) ||
        !!modal.querySelector('[data-gamepad-selected]');
      if (!f.hasInput && focusInside) {
        return;
      }

      const items = getModalCandidates(modal);
      if (items.length === 0) {
        return;
      }
      const current = findCurrent(items);
      if (!current) {
        moveFocusTo(items[0]);
        return;
      }

      if (f.direction) {
        const next = findNext(current, items, f.direction);
        if (next) {
          moveFocusTo(next);
          playNavigateSound();
        } else if (f.direction === 'up' || f.direction === 'down') {
          scrollBy(
            getModalScrollContainer(modal),
            f.direction === 'up' ? -SCROLL_STEP : SCROLL_STEP
          );
        }
      }

      if (f.pressed(BUTTON.A)) {
        activate(current);
      }
    };

    const handleHeader = (f: Frame) => {
      const active = document.activeElement;
      const inHeader = !!active?.closest('[data-gamepad-header]');

      if (isTextInput(active) && inHeader) {
        if (f.held(BUTTON.B) && f.now - lastBWhileTyping > B_WHILE_TYPING_THROTTLE) {
          lastBWhileTyping = f.now;
          playBackSound();
          active.blur();
          switchArea('games');
        }
        return;
      }

      const dropdown = getOpenDropdown(document);
      if (dropdown) {
        handleDropdown(f, dropdown);
        return;
      }

      if (f.pressed(BUTTON.B)) {
        playBackSound();
        switchArea('games');
        return;
      }

      if (
        !f.hasInput &&
        (inHeader || document.querySelector('[data-gamepad-selected]'))
      ) {
        return;
      }

      const targets = getHeaderTargets();
      if (targets.length === 0) {
        return;
      }
      const current = findCurrent(targets);
      if (!current) {
        moveFocusTo(targets[0]);
        return;
      }

      if (f.direction === 'left' || f.direction === 'right') {
        const next = findNext(current, targets, f.direction);
        if (next) {
          moveFocusTo(next);
          playNavigateSound();
        }
      } else if (f.direction === 'down') {
        playNavigateSound();
        switchArea('games');
      }

      if (f.pressed(BUTTON.A)) {
        const before = pathnameRef.current;
        activate(current);
        // Header links (news, guides, home) open a page — follow focus into it
        setTimeout(() => {
          if (pathnameRef.current !== before && !getTopDialog()) {
            switchArea('main-content');
          }
        }, 50);
      }
    };

    const handleGames = (f: Frame) => {
      const total = getTotalGameCards();
      const index = currentGameIndex();
      const container = getGameList();
      // Cards mount late on cold start (catalog sync) — pick focus up once they exist
      if (container && !container.contains(document.activeElement)) {
        getCardByIndex(index)?.focus({ preventScroll: true });
      }

      if (total > 0) {
        if (f.direction === 'left' || f.direction === 'right') {
          navigateToGame(index + (f.direction === 'left' ? -1 : 1));
        }
        if (f.pressed(BUTTON.LB) || f.pressed(BUTTON.RB)) {
          const pageSize = Math.max(
            1,
            Math.floor((container?.clientWidth ?? 0) / GAMEPAD_CARD_STRIDE) - 1
          );
          navigateToGame(index + (f.pressed(BUTTON.LB) ? -pageSize : pageSize));
        }
        if (f.pressed(BUTTON.LT)) {
          navigateToGame(0);
        }
        if (f.pressed(BUTTON.RT)) {
          navigateToGame(total - 1);
        }
        if (f.pressed(BUTTON.A)) {
          openCard(index, false);
          return;
        }
      }

      if (f.direction === 'up') {
        playNavigateSound();
        const card = getCardByIndex(index);
        const targets = getHeaderTargets();
        const above = card ? findNext(card, targets, 'up') : null;
        switchArea('header');
        if (above ?? targets[0]) {
          moveFocusTo(above ?? targets[0]);
        }
      } else if (f.direction === 'down') {
        playNavigateSound();
        switchArea('main-content');
      }

      if (f.pressed(BUTTON.B) && !isHome()) {
        goHome();
      }
    };

    const handleMainContent = (f: Frame, justEntered: boolean) => {
      const root = getMainContent();
      if (!root) {
        return;
      }

      if (f.pressed(BUTTON.B)) {
        playBackSound();
        switchArea('games');
        return;
      }

      const active = document.activeElement;
      if (!justEntered && !f.hasInput && active !== root && root.contains(active)) {
        return;
      }

      const items = getMainCandidates(root);
      const visibleItems = items.filter((el) => intersects(el, root));
      const current = findCurrent(items);
      const currentVisible = !!current && intersects(current, root);

      if ((justEntered || !current) && items.length > 0) {
        const primary = visibleItems.find((el) =>
          el.hasAttribute('data-gamepad-primary-action')
        );
        const target = primary ?? visibleItems[0];
        if (target) {
          moveFocusTo(target, root);
        }
        return;
      }

      if (f.pressed(BUTTON.LT) || f.pressed(BUTTON.RT)) {
        const sign = f.pressed(BUTTON.LT) ? -1 : 1;
        scrollBy(root, sign * root.clientHeight * PAGE_SCROLL_RATIO);
      }

      if (isGamePage() && (f.pressed(BUTTON.LB) || f.pressed(BUTTON.RB))) {
        const total = getTotalGameCards();
        const target = currentGameIndex() + (f.pressed(BUTTON.LB) ? -1 : 1);
        if (target >= 0 && target < total) {
          indexBeforeSwitch = {
            index: store().focusedGameIndex,
            pathname: pathnameRef.current,
          };
          store().setFocusedGameIndex(target);
          openCard(target, true);
        }
        return;
      }

      if (f.direction) {
        const vertical = f.direction === 'up' || f.direction === 'down';
        if (!current || !currentVisible) {
          // Focus scrolled away with the right stick — resume from what is on screen
          const ordered = f.direction === 'up' || f.direction === 'left';
          const target = ordered
            ? visibleItems[visibleItems.length - 1]
            : visibleItems[0];
          if (target) {
            moveFocusTo(target, root);
            playNavigateSound();
          } else if (vertical) {
            scrollBy(root, f.direction === 'up' ? -SCROLL_STEP : SCROLL_STEP);
          }
        } else {
          const next = findNext(current, items, f.direction);
          const c = root.getBoundingClientRect();
          const nextRect = next?.getBoundingClientRect();
          const farAway =
            !!nextRect &&
            (nextRect.top - c.bottom > c.height * 0.6 ||
              c.top - nextRect.bottom > c.height * 0.6);
          if (next && !farAway) {
            moveFocusTo(next, root);
            playNavigateSound();
          } else if (f.direction === 'up' && root.scrollTop <= 1) {
            playNavigateSound();
            switchArea('games');
          } else if (vertical) {
            // Long text between controls: scroll towards the next one instead of jumping over it
            scrollBy(root, f.direction === 'up' ? -SCROLL_STEP : SCROLL_STEP);
          }
        }
      }

      if (f.pressed(BUTTON.A)) {
        if (current && currentVisible) {
          activate(current);
        } else if (visibleItems[0]) {
          moveFocusTo(visibleItems[0], root);
          playNavigateSound();
        }
      }
    };

    const scrollWithRightStick = (f: Frame, modal: HTMLElement | null) => {
      const y = f.gp.axes[AXIS.RIGHT_Y] ?? 0;
      if (Math.abs(y) < SCROLL_STICK_DEADZONE) {
        return;
      }
      const container = modal ? getModalScrollContainer(modal) : getMainContent();
      const strength =
        (Math.abs(y) - SCROLL_STICK_DEADZONE) / (1 - SCROLL_STICK_DEADZONE);
      container?.scrollBy({
        top: Math.sign(y) * strength * strength * SCROLL_STICK_SPEED * f.dt,
        behavior: 'auto',
      });
    };

    const updateDirection = (gp: Gamepad, now: number): Direction | null => {
      const raw = readDirection(gp);
      if (raw !== heldDirection) {
        heldDirection = raw;
        heldSince = now;
        lastRepeatAt = now;
        suppressDirection = false;
        return raw;
      }
      if (!raw || suppressDirection) {
        return null;
      }
      if (now - heldSince >= REPEAT_DELAY && now - lastRepeatAt >= REPEAT_INTERVAL) {
        lastRepeatAt = now;
        return raw;
      }
      return null;
    };

    const trackModalFocus = (modalOpen: boolean) => {
      if (modalOpen && !wasModalOpen) {
        focusBeforeModal = document.activeElement as HTMLElement | null;
        clearSelected();
      } else if (!modalOpen && wasModalOpen) {
        clearSelected();
        if (indexBeforeSwitch?.pathname === pathnameRef.current) {
          store().setFocusedGameIndex(indexBeforeSwitch.index);
        }
        indexBeforeSwitch = null;
        if (focusBeforeModal?.isConnected) {
          focusBeforeModal.focus({ preventScroll: true });
        } else {
          document.querySelector<HTMLElement>('[data-gamepad-primary-action]')?.focus();
        }
        focusBeforeModal = null;
      }
      wasModalOpen = modalOpen;
    };

    const restoreDropdownTrigger = () => {
      if (!dropdownTrigger || getOpenDropdown(document)) {
        return;
      }
      if (dropdownTrigger.isConnected && document.activeElement === document.body) {
        dropdownTrigger.focus({ preventScroll: true });
      }
      dropdownTrigger = null;
    };

    const computeHintContext = (
      modal: HTMLElement | null,
      area: Area
    ): GamepadHintContext => {
      if (isSearchInput(document.activeElement)) {
        return 'search-input';
      }
      if (isTextInput(document.activeElement)) {
        return 'text-input';
      }
      if (getOpenDropdown(modal ?? document)) {
        return 'dropdown';
      }
      return modal ? 'modal' : area;
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      let gp: Gamepad | null = null;
      for (const pad of navigator.getGamepads()) {
        if (pad?.connected && isValidGamepad(pad)) {
          gp = pad;
          break;
        }
      }
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrameAt) / 1000);
      lastFrameAt = now;
      if (!gp) {
        return;
      }

      const buttons = gp.buttons.map((b) => b?.pressed ?? false);
      const previous = prevButtons;
      prevButtons = buttons;
      const direction = updateDirection(gp, now);
      const f: Frame = {
        now,
        dt,
        gp,
        direction,
        hasInput: direction !== null || buttons.some((b, i) => b && !previous[i]),
        pressed: (b) => !!buttons[b] && !previous[b],
        held: (b) => !!buttons[b],
      };

      if (indexBeforeSwitch && indexBeforeSwitch.pathname !== pathnameRef.current) {
        indexBeforeSwitch = null;
      }
      const modal = getTopDialog();
      trackModalFocus(!!modal);
      restoreDropdownTrigger();

      const isTyping = isTextInput(document.activeElement);
      const area = store().navigationArea;
      const searchInput = f.pressed(BUTTON.Y) ? getActiveSearchInput(modal) : null;
      if (searchInput && searchInput.value !== '') {
        playBackSound();
        clearInput(searchInput);
      } else if (f.pressed(BUTTON.VIEW) && !isTyping) {
        playNavigateSound();
        store().setHelpOpen(!store().isHelpOpen);
      } else if (modal) {
        handleModal(f, modal);
      } else if (!isTyping && f.pressed(BUTTON.Y)) {
        goHome();
      } else if (!isTyping && f.pressed(BUTTON.X)) {
        focusSearch();
      } else if (!isTyping && f.pressed(BUTTON.MENU)) {
        playConfirmSound();
        useSettingsStore.getState().openSettingsModal();
      } else if (area === 'header') {
        handleHeader(f);
      } else if (area === 'games') {
        handleGames(f);
      } else {
        handleMainContent(f, prevArea !== 'main-content');
      }

      // The area this frame dispatched on, so a switch made mid-frame reads as "just entered" next frame
      if (!modal) {
        prevArea = area;
      }
      if (!isTyping) {
        scrollWithRightStick(f, modal);
      }

      const hint = computeHintContext(getTopDialog(), store().navigationArea);
      if (store().hintContext !== hint) {
        store().setHintContext(hint);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  // Also covers components that send focus back to the strip (e.g. "view all")
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const focusCurrent = () => {
      const total = getTotalGameCards();
      if (total > 0) {
        focusCard(Math.min(useGamepadModeStore.getState().focusedGameIndex, total - 1));
      }
    };
    focusCurrent();
    return useGamepadModeStore.subscribe((state, prev) => {
      if (state.navigationArea === 'games' && prev.navigationArea !== 'games') {
        focusCurrent();
      }
    });
  }, [enabled]);
}
