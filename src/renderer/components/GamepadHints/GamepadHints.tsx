import React, { useEffect, useState } from 'react';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';

interface HintItem {
  button: string;
  label: string;
  variant?: 'green' | 'red' | 'default';
}

const ButtonHint: React.FC<HintItem> = ({ button, label, variant = 'default' }) => {
  const colors = {
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
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

  let hints: HintItem[] = [];

  if (isModalOpen) {
    hints = [
      { button: 'A', label: 'Вибрати', variant: 'green' },
      { button: 'B', label: 'Закрити', variant: 'red' },
      { button: '↑↓', label: 'Навігація' },
    ];
  } else if (navigationArea === 'header') {
    hints = [
      { button: 'A', label: 'Відкрити', variant: 'green' },
      { button: '←→', label: 'Елементи' },
      { button: '↓', label: 'До ігор' },
    ];
  } else if (navigationArea === 'games') {
    hints = [
      { button: 'A', label: 'Вибрати', variant: 'green' },
      { button: '←→', label: 'Ігри' },
      { button: '↑', label: 'Пошук' },
      { button: '↓', label: 'Контент' },
    ];
  } else if (navigationArea === 'main-content') {
    hints = [
      { button: 'A', label: 'Вибрати', variant: 'green' },
      { button: 'B', label: 'Назад', variant: 'red' },
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
