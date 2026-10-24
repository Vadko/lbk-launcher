export type GamepadType = 'xbox' | 'playstation';

type GlyphVariant = 'green' | 'red' | 'blue' | 'yellow' | 'default';

export interface Glyph {
  label: string;
  variant: GlyphVariant;
}

type GlyphName =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'view'
  | 'menu'
  | 'dpad'
  | 'rs'
  | 'up'
  | 'down'
  | 'leftRight'
  | 'upDown';

const plain = (label: string): Glyph => ({ label, variant: 'default' });

const SHARED: Record<
  Exclude<GlyphName, 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt'>,
  Glyph
> = {
  view: plain('⧉'),
  menu: plain('☰'),
  dpad: plain('✛'),
  rs: plain('RS'),
  up: plain('↑'),
  down: plain('↓'),
  leftRight: plain('←→'),
  upDown: plain('↑↓'),
};

export const GAMEPAD_GLYPHS: Record<GamepadType, Record<GlyphName, Glyph>> = {
  xbox: {
    ...SHARED,
    a: { label: 'A', variant: 'green' },
    b: { label: 'B', variant: 'red' },
    x: { label: 'X', variant: 'blue' },
    y: { label: 'Y', variant: 'yellow' },
    lb: plain('LB'),
    rb: plain('RB'),
    lt: plain('LT'),
    rt: plain('RT'),
  },
  playstation: {
    ...SHARED,
    a: { label: '✕', variant: 'blue' },
    b: { label: '○', variant: 'red' },
    x: plain('□'),
    y: { label: '△', variant: 'green' },
    lb: plain('L1'),
    rb: plain('R1'),
    lt: plain('L2'),
    rt: plain('R2'),
  },
};

export const GLYPH_VARIANT_CLASSES: Record<GlyphVariant, string> = {
  green: 'bg-green-500/20 border-green-500/50 text-green-400',
  red: 'bg-red-500/20 border-red-500/50 text-red-400',
  blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  default: 'bg-white/10 border-white/20 text-white',
};
