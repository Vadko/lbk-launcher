import type { StyleDefinition } from '@dicebear/core';
import { fail } from './fail';
import { SIZE } from './grid';
import { type Point, pathPolylines } from './pathPolylines';
import { baseComponent, type StyleElement } from './styleDefinition';

interface Frame {
  readonly w: number;
  readonly h: number;
}

type Segment = readonly [Point, Point];
type OrnamentName = 'rect' | 'defs' | 'pattern' | 'path' | 'g' | 'circle' | 'style';

interface Ornament {
  readonly attributes: readonly string[];
  readonly children: 'elements' | 'text' | 'none';
  readonly check: (e: StyleElement, frame: Frame, where: string) => Frame;
}

// Coordinates are written with two decimals, so a mirrored point may land 0.01 off
const TOLERANCE = 0.011;
const TEXTURE_CSS = /^@media\(max-width:[\d.]+px\)\{\.t\{display:none\}\}$/;

function text(e: StyleElement, key: string, where: string): string | undefined {
  const v = e.attributes?.[key];
  return typeof v === 'object' ? fail(`${where}: ${key} must be text`) : v;
}

function num(e: StyleElement, key: string, where: string): number {
  const v = Number(text(e, key, where) ?? fail(`${where}: ${e.name} needs ${key}`));
  return Number.isFinite(v) ? v : fail(`${where}: ${key} must be a number`);
}

const near = (a: Point, b: Point): boolean =>
  Math.abs(a[0] - b[0]) <= TOLERANCE && Math.abs(a[1] - b[1]) <= TOLERANCE;

function segments(d: string): Segment[] {
  return pathPolylines(d).flatMap(({ points, closed }): Segment[] => {
    const ring = closed ? [...points, points[0]] : points;
    return ring.length === 1
      ? [[ring[0], ring[0]]]
      : ring.slice(1).map((p, i): Segment => [ring[i], p]);
  });
}

// True when every drawn segment, mapped through the mirror, lands on a drawn segment
function holds(segs: readonly Segment[], map: (p: Point) => Point): boolean {
  return segs.every(([p, q]) => {
    const [mp, mq] = [map(p), map(q)];
    return segs.some(
      ([s, t]) => (near(s, mp) && near(t, mq)) || (near(s, mq) && near(t, mp))
    );
  });
}

// One dash length, an even dash count and a dash or gap centred on the start point keep a dashed ring on both axes
function checkDashes(e: StyleElement, where: string): void {
  const dashes = text(e, 'stroke-dasharray', where);
  if (dashes === undefined) {
    return;
  }
  const length = num(e, 'pathLength', where);
  const list = dashes
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (list.length > 2 || list.some((v) => !(v >= 0))) {
    fail(`${where}: stroke-dasharray ${dashes} must be one dash and one gap`);
  }
  const [on, off = on] = list;
  const half = (on + off) / 2;
  const count = length / half;
  const phase =
    (((on / 2 - Number(text(e, 'stroke-dashoffset', where) ?? '0')) % half) + half) %
    half;
  if (
    Math.abs(count / 4 - Math.round(count / 4)) > 1e-9 ||
    Math.min(phase, half - phase) > 1e-9
  ) {
    fail(`${where}: dashes ${dashes} over ${length} leave the mirror axes`);
  }
}

const ORNAMENTS: Record<OrnamentName, Ornament> = {
  rect: {
    attributes: ['width', 'height', 'fill', 'class'],
    children: 'none',
    check: (e, frame, where) => {
      if (num(e, 'width', where) !== frame.w || num(e, 'height', where) !== frame.h) {
        fail(`${where}: a rect must cover its whole ${frame.w}x${frame.h} frame`);
      }
      return frame;
    },
  },
  circle: {
    attributes: [
      'cx',
      'cy',
      'r',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'pathLength',
      'stroke-dasharray',
      'stroke-dashoffset',
    ],
    children: 'none',
    check: (e, frame, where) => {
      if (num(e, 'cx', where) !== frame.w / 2 || num(e, 'cy', where) !== frame.h / 2) {
        fail(`${where}: a circle must sit on the centre of its frame`);
      }
      checkDashes(e, where);
      return frame;
    },
  },
  path: {
    attributes: [
      'd',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linejoin',
      'stroke-linecap',
    ],
    children: 'none',
    check: (e, frame, where) => {
      const segs = segments(text(e, 'd', where) ?? fail(`${where}: path needs d`));
      const vertical = holds(segs, ([x, y]) => [frame.w - x, y]);
      const horizontal = holds(segs, ([x, y]) => [x, frame.h - y]);
      if (!vertical || !horizontal) {
        fail(`${where}: a path lost its mirror axes`);
      }
      return frame;
    },
  },
  pattern: {
    attributes: ['id', 'width', 'height', 'patternUnits'],
    children: 'elements',
    check: (e, frame, where) => {
      const tile = { w: num(e, 'width', where), h: num(e, 'height', where) };
      // Tiles start at the origin, so they stay on the mirror axes only when a whole number of them spans the canvas
      if (
        text(e, 'patternUnits', where) !== 'userSpaceOnUse' ||
        !Number.isInteger(frame.w / tile.w) ||
        !Number.isInteger(frame.h / tile.h)
      ) {
        fail(`${where}: a pattern must tile the canvas evenly in user space`);
      }
      return tile;
    },
  },
  defs: { attributes: [], children: 'elements', check: (_e, frame) => frame },
  g: {
    attributes: ['stroke', 'color', 'fill', 'stroke-width'],
    children: 'elements',
    check: (_e, frame) => frame,
  },
  style: {
    attributes: [],
    children: 'text',
    check: (e, frame, where) => {
      const [only, ...rest] = e.children ?? [];
      if (
        only?.type !== 'text' ||
        rest.length > 0 ||
        !TEXTURE_CSS.test(String(only.value))
      ) {
        fail(`${where}: style may only hide the texture at small sizes`);
      }
      return frame;
    },
  },
};

const isOrnament = (name: string | undefined): name is OrnamentName =>
  name !== undefined && Object.hasOwn(ORNAMENTS, name);

function walk(elements: readonly StyleElement[], frame: Frame, where: string): void {
  for (const e of elements) {
    if (e.type === 'component') {
      continue;
    }
    if (e.type !== 'element' || !isOrnament(e.name)) {
      fail(`${where}: ${e.type} ${e.name ?? ''} is not an allowed ornament`);
    }
    const ornament = ORNAMENTS[e.name];
    const stray = Object.keys(e.attributes ?? {}).filter(
      (key) => !ornament.attributes.includes(key)
    );
    if (stray.length > 0) {
      fail(`${where}: ${e.name} may not carry ${stray.join(', ')}`);
    }
    if (ornament.children === 'none' && (e.children?.length ?? 0) > 0) {
      fail(`${where}: ${e.name} may not have children`);
    }
    const inner = ornament.check(e, frame, `${where} ${e.name}`);
    if (ornament.children === 'elements') {
      walk(e.children ?? [], inner, `${where} ${e.name}`);
    }
  }
}

// Borders and the palette's own elements sit outside the mirrored quarter, so their geometry must carry both mirror axes itself
export function checkOrnaments(def: StyleDefinition): void {
  if (def.attributes !== undefined || def.colors !== undefined) {
    fail('the definition may not set root attributes or colours');
  }
  for (const name of ['b', 'p']) {
    for (const [vName, v] of Object.entries(baseComponent(def, name).variants)) {
      walk(v.elements, { w: SIZE, h: SIZE }, `${name}.${vName}`);
    }
  }
}
