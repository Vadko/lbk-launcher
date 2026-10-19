import React from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@/shared/i18n/i18n';
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
  const help: Hint = { glyphs: [g.view], label: t('gamepadHints.allButtons') };
  switch (context) {
    case 'text-input':
      return [{ glyphs: [g.b], label: t('gamepadHints.finishInput') }];
    case 'search-input':
      return [
        { glyphs: [g.y], label: t('gamepadHints.clear') },
        { glyphs: [g.b], label: t('gamepadHints.finishInput') },
      ];
    case 'dropdown':
      return [
        { glyphs: [g.a], label: t('gamepadHints.select') },
        { glyphs: [g.upDown], label: t('gamepadHints.items') },
        { glyphs: [g.b], label: t('common.close') },
      ];
    case 'modal':
      return [
        { glyphs: [g.a], label: t('gamepadHints.select') },
        { glyphs: [g.dpad], label: t('gamepadHints.navigation') },
        { glyphs: [g.rs], label: t('gamepadHints.scroll') },
        { glyphs: [g.b], label: t('common.close') },
      ];
    case 'header':
      return [
        { glyphs: [g.a], label: t('gamepadHints.open') },
        { glyphs: [g.leftRight], label: t('gamepadHints.menu') },
        { glyphs: [g.down, g.b], label: t('gamepadHints.toGames') },
        help,
      ];
    case 'games':
      return [
        { glyphs: [g.a], label: t('gamepadHints.open') },
        { glyphs: [g.leftRight], label: t('gamepadHints.games') },
        { glyphs: [g.up], label: t('gamepadHints.menu') },
        { glyphs: [g.down], label: t('gamepadHints.page') },
        { glyphs: [g.x], label: t('gamepadHints.search') },
        { glyphs: page.isHome ? [g.y] : [g.y, g.b], label: t('gamepadHints.home') },
        help,
      ];
    case 'main-content':
      return [
        { glyphs: [g.a], label: t('gamepadHints.select') },
        { glyphs: [g.dpad], label: t('gamepadHints.navigation') },
        { glyphs: [g.rs], label: t('gamepadHints.scroll') },
        ...(page.isGame
          ? [{ glyphs: [g.lb, g.rb], label: t('gamepadHints.adjacentTranslation') }]
          : []),
        { glyphs: [g.b], label: t('gamepadHints.toGames') },
        ...(page.isHome ? [] : [{ glyphs: [g.y], label: t('gamepadHints.home') }]),
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
