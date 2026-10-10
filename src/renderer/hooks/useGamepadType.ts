import { useEffect, useState } from 'react';
import type { GamepadType } from '../components/GamepadHints/gamepadGlyphs';

const detectGamepadType = (): GamepadType => {
  for (const gp of navigator.getGamepads()) {
    const id = gp?.id.toLowerCase() ?? '';
    if (['playstation', 'dualshock', 'dualsense', 'sony'].some((p) => id.includes(p))) {
      return 'playstation';
    }
  }
  return 'xbox';
};

// Re-detects on plug/unplug so the glyphs (A/B vs ✕/○) follow the pad in hand
export function useGamepadType(): GamepadType {
  const [type, setType] = useState<GamepadType>(detectGamepadType);
  useEffect(() => {
    const update = () => setType(detectGamepadType());
    window.addEventListener('gamepadconnected', update);
    window.addEventListener('gamepaddisconnected', update);
    return () => {
      window.removeEventListener('gamepadconnected', update);
      window.removeEventListener('gamepaddisconnected', update);
    };
  }, []);
  return type;
}
