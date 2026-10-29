import { el, type StyleAttributes, type StyleElement } from './styleDefinition';

const coordinate = (v: number): string => v.toFixed(2).replace(/\.?0+$/, '');

// Zigzag ring of 16 teeth; 32 points from angle 0 keep it on all four mirror axes
function teeth(): string {
  const points = Array.from({ length: 32 }, (_, k) => {
    const r = k % 2 === 0 ? 12.5 : 11.6;
    const t = (k * Math.PI) / 16;
    return `${coordinate(13 + r * Math.cos(t))} ${coordinate(13 + r * Math.sin(t))}`;
  });
  return `M${points.join('L')}z`;
}

const ring = (attributes: StyleAttributes): StyleElement =>
  el('circle', { cx: '13', cy: '13', r: '12.2', fill: 'none', ...attributes });

// Borders inherit the threads: stroke is the main thread, currentColor the fill thread; dash counts divide by eight
export const BORDERS: Record<string, { weight: number; elements: StyleElement[] }> = {
  line: { weight: 2, elements: [ring({ 'stroke-width': '.7' })] },
  lineB: {
    weight: 2,
    elements: [ring({ stroke: 'currentColor', 'stroke-width': '.7' })],
  },
  running: {
    weight: 2,
    elements: [
      ring({
        'stroke-width': '.9',
        pathLength: '32',
        'stroke-dasharray': '.55 .45',
        'stroke-dashoffset': '.275',
      }),
    ],
  },
  beads: {
    weight: 2,
    elements: [
      ring({
        r: '12',
        stroke: 'currentColor',
        'stroke-width': '1.3',
        'stroke-linecap': 'round',
        pathLength: '24',
        'stroke-dasharray': '0 1',
      }),
    ],
  },
  double: {
    weight: 1,
    elements: [
      ring({ r: '12.4', 'stroke-width': '.45' }),
      ring({ r: '11.7', stroke: 'currentColor', 'stroke-width': '.45' }),
    ],
  },
  teeth: {
    weight: 1,
    elements: [
      el('path', {
        fill: 'none',
        'stroke-width': '.6',
        'stroke-linejoin': 'round',
        d: teeth(),
      }),
    ],
  },
};
