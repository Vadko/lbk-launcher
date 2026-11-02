import { LRUCache } from 'lru-cache';

// The text's width in em, which the stylesheet divides its container's width by to size the font
export type NicknameFitStyle = React.CSSProperties & { '--fit-em'?: number };

export interface NicknameFont {
  weight: number;
  sizePx: number;
}

const NO_FIT: NicknameFitStyle = {};
// Canvas and layout round glyph advances apart, so the longest words get a little room to spare
const FIT_SLACK = 1.02;

// Bounded: decoys bring new words with every spin, and a word is measured once
const widths = new LRUCache<string, number>({ max: 600 });

let context: CanvasRenderingContext2D | null | undefined;
let family: string | undefined;

function measuringContext(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    context = document.createElement('canvas').getContext('2d');
  }
  return context;
}

// Measured on a canvas in the page's own body font; a width taken before that font has loaded is not kept
export function nicknameFitStyle(
  text: string,
  { weight, sizePx }: NicknameFont
): NicknameFitStyle {
  const canvas = measuringContext();
  if (!canvas) {
    return NO_FIT;
  }
  family ??= getComputedStyle(document.body).fontFamily;
  const font = `${weight} ${sizePx}px ${family}`;
  const key = `${font}\n${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    canvas.font = font;
    width = canvas.measureText(text).width;
    if (document.fonts.check(font, text)) {
      widths.set(key, width);
    }
  }
  return width > 0
    ? { '--fit-em': Math.ceil((width / sizePx) * FIT_SLACK * 100) / 100 }
    : NO_FIT;
}
