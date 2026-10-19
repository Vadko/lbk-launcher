import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGamepadType } from '../../hooks/useGamepadType';
import {
  type GamepadHintContext,
  useGamepadModeStore,
} from '../../store/useGamepadModeStore';
import { ButtonGlyph } from './ButtonGlyph';
import { GAMEPAD_GLYPHS, type Glyph } from './gamepadGlyphs';

interface Hint {
  glyphs: Glyph[];
  label: string;
}

type Glyphs = (typeof GAMEPAD_GLYPHS)['xbox'];

const buildHints = (
  context: GamepadHintContext,
  g: Glyphs,
  page: { isHome: boolean; isGame: boolean }
): Hint[] => {
  const help: Hint = { glyphs: [g.view], label: 'Усі кнопки' };
  switch (context) {
    case 'text-input':
      return [{ glyphs: [g.b], label: 'Завершити введення' }];
    case 'search-input':
      return [
        { glyphs: [g.y], label: 'Очистити' },
        { glyphs: [g.b], label: 'Завершити введення' },
      ];
    case 'dropdown':
      return [
        { glyphs: [g.a], label: 'Вибрати' },
        { glyphs: [g.upDown], label: 'Пункти' },
        { glyphs: [g.b], label: 'Закрити' },
      ];
    case 'modal':
      return [
        { glyphs: [g.a], label: 'Вибрати' },
        { glyphs: [g.dpad], label: 'Навігація' },
        { glyphs: [g.rs], label: 'Прокрутка' },
        { glyphs: [g.b], label: 'Закрити' },
      ];
    case 'header':
      return [
        { glyphs: [g.a], label: 'Відкрити' },
        { glyphs: [g.leftRight], label: 'Меню' },
        { glyphs: [g.down, g.b], label: 'До ігор' },
        help,
      ];
    case 'games':
      return [
        { glyphs: [g.a], label: 'Відкрити' },
        { glyphs: [g.leftRight], label: 'Ігри' },
        { glyphs: [g.up], label: 'Меню' },
        { glyphs: [g.down], label: 'Сторінка' },
        { glyphs: [g.x], label: 'Пошук' },
        { glyphs: page.isHome ? [g.y] : [g.y, g.b], label: 'Головна' },
        help,
      ];
    case 'main-content':
      return [
        { glyphs: [g.a], label: 'Вибрати' },
        { glyphs: [g.dpad], label: 'Навігація' },
        { glyphs: [g.rs], label: 'Прокрутка' },
        ...(page.isGame ? [{ glyphs: [g.lb, g.rb], label: 'Сусідній переклад' }] : []),
        { glyphs: [g.b], label: 'До ігор' },
        ...(page.isHome ? [] : [{ glyphs: [g.y], label: 'Головна' }]),
        help,
      ];
  }
};

export const GamepadHints: React.FC = () => {
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);
  const context = useGamepadModeStore((s) => s.hintContext);
  const { pathname } = useLocation();
  const gamepadType = useGamepadType();

  if (!isGamepadMode) {
    return null;
  }

  const hints = buildHints(context, GAMEPAD_GLYPHS[gamepadType], {
    isHome: pathname === '/',
    isGame: pathname.startsWith('/game/'),
  });

  return (
    <div
      data-gamepad-hints={context}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10001 pointer-events-none"
    >
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 whitespace-nowrap">
        {hints.map((hint) => (
          <div key={hint.label} className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {hint.glyphs.map((glyph) => (
                <ButtonGlyph key={glyph.label} glyph={glyph} />
              ))}
            </span>
            <span className="text-sm text-white/80">{hint.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
