import { useEffect, useRef, useState } from 'react';
import { useGamepads } from 'react-ts-gamepads';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { isValidGamepad } from '../utils/isValidGamepad';

const AXIS = {
  RIGHT_Y: 3,
};

const DEADZONE = 0.3;
const SCROLL_SPEED = 15; // Pixels per frame
const SCROLL_BOOST = 2.5; // Multiplier for stick strength

/**
 * Hook for scrolling modal content using the right stick on gamepad
 */
export function useGamepadModalScroll<T extends HTMLElement = HTMLElement>(
  isOpen: boolean,
  scrollContainerRef: React.RefObject<T | null>
) {
  const { isGamepadMode } = useGamepadModeStore();
  const animationFrameRef = useRef<number | null>(null);
  const [gamepads, setGamepads] = useState<Record<number, Gamepad>>({});

  // Subscribe to gamepad updates - must be called at top level
  useGamepads((pads) => {
    const filtered: Record<number, Gamepad> = {};
    for (const [key, pad] of Object.entries(pads)) {
      if (isValidGamepad(pad)) {
        filtered[Number(key)] = pad;
      }
    }
    setGamepads((prev) => {
      // No valid gamepads now and state already empty — keep same reference, skip re-render
      if (Object.keys(filtered).length === 0 && Object.keys(prev).length === 0) {
        return prev;
      }
      return filtered;
    });
  });

  useEffect(() => {
    if (!isOpen || !isGamepadMode || !scrollContainerRef.current) {
      return;
    }

    const scroll = () => {
      if (!scrollContainerRef.current) {
        return;
      }

      // Check first connected gamepad
      const gamepad = Object.values(gamepads)[0];
      if (!gamepad) {
        animationFrameRef.current = requestAnimationFrame(scroll);
        return;
      }

      const rightStickY = gamepad.axes[AXIS.RIGHT_Y] ?? 0;

      // Apply deadzone and scroll
      if (Math.abs(rightStickY) > DEADZONE) {
        const scrollAmount = rightStickY * SCROLL_SPEED * SCROLL_BOOST;
        scrollContainerRef.current.scrollBy({
          top: scrollAmount,
          behavior: 'auto', // Use 'auto' for smooth continuous scrolling
        });
      }

      animationFrameRef.current = requestAnimationFrame(scroll);
    };

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, isGamepadMode, scrollContainerRef, gamepads]);
}
