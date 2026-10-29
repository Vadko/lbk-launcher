import { fail } from './fail';
import { PALETTES } from './palettes';

// The launcher's own page background, which a dark disc's rim must stand out from
const PAGE = '#0f0f10';
// The launcher cream reads lemon next to the linen canvases, so it may only be a thread
const BRAND_CREAM = '#efeead';

function rgb(hex: string): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const linear = (c: number): number =>
  c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function labOfLinear([r, g, b]: number[]): number[] {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

// Linear-RGB projections that simulate deuteranopia and protanopia
const DICHROMACY: Record<'deutan' | 'protan', number[][]> = {
  deutan: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1],
  ],
  protan: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1],
  ],
};

function deltaE(a: string, b: string, kind: keyof typeof DICHROMACY): number {
  const m = DICHROMACY[kind];
  const seen = (hex: string) => {
    const v = rgb(hex).map(linear);
    return labOfLinear(
      m.map((row) =>
        Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))
      )
    );
  };
  const p = seen(a);
  const q = seen(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// The form thread must read against the canvas, and touching threads must stay apart for dichromats
export function checkPalettes(): void {
  for (const p of PALETTES) {
    const form = contrast(p.a, p.canvas);
    if (form < 4.5) {
      fail(`palette ${p.name}: main thread ${form.toFixed(2)}:1 against the canvas`);
    }
    if (p.rim && contrast(p.rim, PAGE) < 3) {
      fail(`palette ${p.name}: rim too dark for the page`);
    }
    if (p.canvas === BRAND_CREAM) {
      fail(`palette ${p.name}: the brand cream is a thread colour, not a canvas`);
    }
    const pairs: Array<[string, string]> = [
      [p.a, p.b],
      [p.a, p.c],
      [p.b, p.c],
    ];
    const worst = pairs
      .filter(([x, y]) => x !== y)
      .map(([x, y]) => Math.min(deltaE(x, y, 'deutan'), deltaE(x, y, 'protan')));
    const min = Math.min(...worst);
    if (min < 20) {
      fail(
        `palette ${p.name}: two touching threads merge for dichromats (dE ${min.toFixed(1)})`
      );
    }
    const fill = Math.min(contrast(p.b, p.canvas), contrast(p.c, p.canvas));
    if (fill < 1.5) {
      fail(
        `palette ${p.name}: a fill thread vanishes into the canvas (${fill.toFixed(2)}:1)`
      );
    }
  }
}
