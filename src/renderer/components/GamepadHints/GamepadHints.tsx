import React, { useEffect, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';

type GamepadType = 'xbox' | 'playstation';

type ButtonVariant = 'green' | 'red' | 'blue' | 'default';

interface HintItem {
  button: string;
  label: string;
  variant?: ButtonVariant;
}

// Button mappings for different controller types
const BUTTON_CONFIG: Record<
  GamepadType,
  {
    confirm: { label: string; variant: ButtonVariant };
    back: { label: string; variant: ButtonVariant };
  }
> = {
  xbox: {
    confirm: { label: 'A', variant: 'green' },
    back: { label: 'B', variant: 'red' },
  },
  playstation: {
    confirm: { label: '✕', variant: 'blue' }, // PlayStation Cross - blue
    back: { label: '○', variant: 'red' }, // PlayStation Circle - red
  },
};

/**
 * Detect the type of connected gamepad based on its ID
 */
function detectGamepadType(): GamepadType {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    const id = gp.id.toLowerCase();
    if (
      id.includes('playstation') ||
      id.includes('dualshock') ||
      id.includes('dualsense') ||
      id.includes('sony')
    ) {
      return 'playstation';
    }
  }
  return 'xbox';
}

const ButtonHint: React.FC<HintItem> = ({ button, label, variant = 'default' }) => {
  const colors: Record<ButtonVariant, string> = {
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400', // PlayStation Cross
    default: 'bg-white/10 border-white/20 text-white',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg border font-bold text-sm ${colors[variant]}`}
      >
        {button}
      </div>
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
};

export const GamepadHints: React.FC = () => {
  const { isGamepadMode, navigationArea } = useGamepadModeStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gamepadType, setGamepadType] = useState<GamepadType>(() => detectGamepadType());

  useEffect(() => {
    if (!isGamepadMode) return;

    const checkModal = () => {
      setIsModalOpen(!!document.querySelector('[role="dialog"]'));
    };

    checkModal();

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isGamepadMode]);

  if (!isGamepadMode) return null;

  const { confirm, back } = BUTTON_CONFIG[gamepadType];
  let hints: HintItem[] = [];

  if (isModalOpen) {
    hints = [
      { button: confirm.label, label: 'Вибрати', variant: confirm.variant },
      { button: back.label, label: 'Закрити', variant: back.variant },
      { button: '↑↓', label: 'Навігація' },
    ];
  } else if (navigationArea === 'header') {
    hints = [
      { button: confirm.label, label: 'Відкрити', variant: confirm.variant },
      { button: '←→', label: 'Елементи' },
      { button: '↓', label: 'До ігор' },
    ];
  } else if (navigationArea === 'games') {
    hints = [
      { button: confirm.label, label: 'Вибрати', variant: confirm.variant },
      { button: '←→', label: 'Ігри' },
      { button: '↑', label: 'Пошук' },
      { button: '↓', label: 'Контент' },
    ];
  } else if (navigationArea === 'main-content') {
    hints = [
      { button: confirm.label, label: 'Вибрати', variant: confirm.variant },
      { button: back.label, label: 'Назад', variant: back.variant },
      { button: '←→', label: 'Кнопки' },
      { button: '↑↓', label: 'Прокрутка' },
    ];
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="flex items-center gap-5 px-5 py-2.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10">
        {hints.map((hint, index) => (
          <ButtonHint key={index} {...hint} />
        ))}
      </div>
    </div>
  );
};
