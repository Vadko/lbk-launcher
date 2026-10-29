import { type Thread, UNIT } from './grid';
import type { StyleAttributes } from './styleDefinition';

export interface Paint {
  readonly attributes: StyleAttributes;
  readonly path: 'stroke' | 'area';
}

// The main thread strokes its runs a cell wide in the palette's stroke; fill and accent fill their cells in currentColor and the inherited fill
export const PAINT: Record<Thread, Paint> = {
  A: { attributes: { 'stroke-width': String(UNIT) }, path: 'stroke' },
  B: { attributes: { fill: 'currentColor' }, path: 'area' },
  C: { attributes: {}, path: 'area' },
};
