import React from 'react';
import { GLYPH_VARIANT_CLASSES, type Glyph } from './gamepadGlyphs';

interface ButtonGlyphProps {
  glyph: Glyph;
}

export const ButtonGlyph: React.FC<ButtonGlyphProps> = ({ glyph }) => (
  <span
    className={`min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-lg border font-bold text-sm ${GLYPH_VARIANT_CLASSES[glyph.variant]}`}
  >
    {glyph.label}
  </span>
);
