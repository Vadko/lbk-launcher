import React from 'react';
import { createPortal } from 'react-dom';
import { useGamepadType } from '../../hooks/useGamepadType';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { ButtonGlyph } from './ButtonGlyph';
import { GAMEPAD_GLYPHS, type Glyph } from './gamepadGlyphs';

interface HelpRow {
  glyphs: Glyph[];
  text: string;
}

interface HelpSection {
  title: string;
  rows: HelpRow[];
}

type Glyphs = (typeof GAMEPAD_GLYPHS)['xbox'];

// Mirrors the bindings in useGamepadModeNavigation — keep the two in sync
const buildSections = (g: Glyphs): HelpSection[] => [
  {
    title: 'Скрізь',
    rows: [
      { glyphs: [g.dpad], text: 'Перейти до сусіднього елемента (утримуйте — швидше)' },
      { glyphs: [g.a], text: 'Натиснути / відкрити' },
      { glyphs: [g.b], text: 'Назад або закрити вікно' },
      { glyphs: [g.rs], text: 'Плавна прокрутка' },
      { glyphs: [g.x], text: 'Пошук гри' },
      { glyphs: [g.y], text: 'Головна сторінка' },
      { glyphs: [g.menu], text: 'Налаштування' },
      { glyphs: [g.view], text: 'Ця довідка' },
    ],
  },
  {
    title: 'Стрічка перекладів',
    rows: [
      { glyphs: [g.leftRight], text: 'Попередній / наступний переклад' },
      { glyphs: [g.lb, g.rb], text: 'Гортати на цілий екран' },
      { glyphs: [g.lt, g.rt], text: 'На початок / в кінець списку' },
      { glyphs: [g.up], text: 'Верхнє меню: пошук, фільтри, новини' },
      { glyphs: [g.down], text: 'До вмісту сторінки' },
      { glyphs: [g.b], text: 'На головну зі сторінки перекладу' },
    ],
  },
  {
    title: 'Сторінка перекладу',
    rows: [
      { glyphs: [g.dpad], text: 'До кнопки чи картки в цьому напрямку' },
      { glyphs: [g.lt, g.rt], text: 'Прокрутити на екран вгору / вниз' },
      { glyphs: [g.lb, g.rb], text: 'Попередній / наступний переклад' },
      { glyphs: [g.up, g.b], text: 'Нагорі сторінки — назад до стрічки перекладів' },
    ],
  },
  {
    title: 'Вікна та поля вводу',
    rows: [
      { glyphs: [g.a], text: 'На полі вводу — почати друк' },
      { glyphs: [g.b], text: 'Завершити друк; ще раз — закрити вікно' },
      { glyphs: [g.y], text: 'На полі пошуку — очистити його' },
      { glyphs: [g.b], text: 'У списку авторів чи тегів — вийти зі списку' },
      { glyphs: [g.lt, g.rt], text: 'Прокрутити вікно на екран' },
    ],
  },
];

export const GamepadHelpOverlay: React.FC = () => {
  const isOpen = useGamepadModeStore((s) => s.isHelpOpen && s.isGamepadMode);
  const setHelpOpen = useGamepadModeStore((s) => s.setHelpOpen);
  const gamepadType = useGamepadType();

  if (!isOpen) {
    return null;
  }

  const sections = buildSections(GAMEPAD_GLYPHS[gamepadType]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Керування геймпадом"
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="w-full max-w-275 max-h-full overflow-y-auto custom-scrollbar rounded-2xl bg-[rgb(15,15,16)] border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-head font-semibold text-text-main mb-1">
          Керування геймпадом
        </h2>
        <p className="text-sm text-text-muted mb-5">
          На Steam Deck екранна клавіатура відкривається комбінацією STEAM + X.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-xl bg-glass p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
                {section.title}
              </h3>
              <ul className="grid gap-2">
                {section.rows.map((row) => (
                  <li key={row.text} className="flex items-center gap-3">
                    <span className="flex shrink-0 gap-1 min-w-[76px]">
                      {row.glyphs.map((glyph) => (
                        <ButtonGlyph key={glyph.label} glyph={glyph} />
                      ))}
                    </span>
                    <span className="text-sm text-text-main">{row.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            data-gamepad-cancel
            className="px-5 py-2 rounded-lg bg-glass border border-border text-text-main hover:bg-glass-hover transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('root') ?? document.body
  );
};
