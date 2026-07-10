import { useEffect } from 'react';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { isValidGamepad } from '../utils/isValidGamepad';

const AXIS = {
  RIGHT_Y: 3,
};

const DEADZONE = 0.3;
const SCROLL_SPEED = 15; // Pixels per frame
const SCROLL_BOOST = 2.5; // Multiplier for stick strength

/**
 * Hook for scrolling modal content using the right stick on gamepad.
 *
 * Polls navigator.getGamepads() in a RAF loop without touching React state,
 * so an open modal with an idle gamepad costs zero re-renders.
 */
export function useGamepadModalScroll<T extends HTMLElement = HTMLElement>(
  isOpen: boolean,
  scrollContainerRef: React.RefObject<T | null>
) {
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);

  useEffect(() => {
    if (!isOpen || !isGamepadMode) {
      return;
    }

    let rafId = 0;

    const scroll = () => {
      const container = scrollContainerRef.current;
      if (!container) {
        rafId = requestAnimationFrame(scroll);
        return;
      }

      const pads = navigator.getGamepads();
      let gp: Gamepad | null = null;
      for (const pad of pads) {
        if (pad && pad.connected && isValidGamepad(pad)) {
          gp = pad;
          break;
        }
      }

      if (gp) {
        const rightStickY = gp.axes[AXIS.RIGHT_Y] ?? 0;
        if (Math.abs(rightStickY) > DEADZONE) {
          container.scrollBy({
            top: rightStickY * SCROLL_SPEED * SCROLL_BOOST,
            behavior: 'auto',
          });
        }
      }

      rafId = requestAnimationFrame(scroll);
    };

    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, isGamepadMode, scrollContainerRef]);
}
