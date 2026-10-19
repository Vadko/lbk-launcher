import React from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/shared/i18n/i18n';
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
    title: t('gamepadHelp.everywhere.title'),
    rows: [
      { glyphs: [g.dpad], text: t('gamepadHelp.everywhere.move') },
      { glyphs: [g.a], text: t('gamepadHelp.everywhere.press') },
      { glyphs: [g.b], text: t('gamepadHelp.everywhere.back') },
      { glyphs: [g.rs], text: t('gamepadHelp.everywhere.scroll') },
      { glyphs: [g.x], text: t('gamepadHelp.everywhere.search') },
      { glyphs: [g.y], text: t('gamepadHelp.everywhere.home') },
      { glyphs: [g.menu], text: t('gamepadHelp.everywhere.settings') },
      { glyphs: [g.view], text: t('gamepadHelp.everywhere.help') },
    ],
  },
  {
    title: t('gamepadHelp.feed.title'),
    rows: [
      { glyphs: [g.leftRight], text: t('gamepadHelp.feed.adjacent') },
      { glyphs: [g.lb, g.rb], text: t('gamepadHelp.feed.page') },
      { glyphs: [g.lt, g.rt], text: t('gamepadHelp.feed.ends') },
      { glyphs: [g.up], text: t('gamepadHelp.feed.header') },
      { glyphs: [g.down], text: t('gamepadHelp.feed.content') },
      { glyphs: [g.b], text: t('gamepadHelp.feed.home') },
    ],
  },
  {
    title: t('gamepadHelp.gamePage.title'),
    rows: [
      { glyphs: [g.dpad], text: t('gamepadHelp.gamePage.move') },
      { glyphs: [g.lt, g.rt], text: t('gamepadHelp.gamePage.scroll') },
      { glyphs: [g.lb, g.rb], text: t('gamepadHelp.gamePage.adjacent') },
      { glyphs: [g.up, g.b], text: t('gamepadHelp.gamePage.back') },
    ],
  },
  {
    title: t('gamepadHelp.dialogs.title'),
    rows: [
      { glyphs: [g.a], text: t('gamepadHelp.dialogs.startTyping') },
      { glyphs: [g.b], text: t('gamepadHelp.dialogs.stopTyping') },
      { glyphs: [g.y], text: t('gamepadHelp.dialogs.clearSearch') },
      { glyphs: [g.b], text: t('gamepadHelp.dialogs.leaveList') },
      { glyphs: [g.lt, g.rt], text: t('gamepadHelp.dialogs.scroll') },
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
      aria-label={t('gamepadHelp.title')}
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="w-full max-w-275 max-h-full overflow-y-auto custom-scrollbar rounded-2xl bg-[rgb(15,15,16)] border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-head font-semibold text-text-main mb-1">
          {t('gamepadHelp.title')}
        </h2>
        <p className="text-sm text-text-muted mb-5">{t('gamepadHelp.deckKeyboard')}</p>
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('root') ?? document.body
  );
};
