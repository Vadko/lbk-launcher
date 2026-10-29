import type { StyleDefinition } from '@dicebear/core';
import { fail } from './fail';
import { THREADS, type Thread, UNIT } from './grid';
import type { Library, PartKind } from './library';
import { PAINT, type Paint } from './paint';
import { pathPolylines } from './pathPolylines';
import { baseComponent, type StyleElement } from './styleDefinition';

const DRAWN: Record<'k' | 'a' | 'x', PartKind> = { k: 'core', a: 'arm', x: 'corner' };

const cell = (col: number, row: number): string => `${col},${row}`;

function stitch(v: number, d: string): number {
  return Number.isInteger(v / UNIT)
    ? v / UNIT
    : fail(`path ${d}: ${v} is off the stitch grid`);
}

// Main-thread runs: one horizontal segment per run, through the middle of its row
function strokeCells(d: string): string[] {
  return pathPolylines(d).flatMap(({ points, closed }) => {
    const [[x0, y0], [x1, y1]] =
      points.length === 2 && !closed ? points : fail(`path ${d}: not a run`);
    if (y0 !== y1 || x1 <= x0) {
      fail(`path ${d}: not a left-to-right run`);
    }
    const row = stitch(y0 - UNIT / 2, d);
    const [from, to] = [stitch(x0, d), stitch(x1, d)];
    return Array.from({ length: to - from }, (_, i) => cell(from + i, row));
  });
}

// Fill and accent blocks: one closed axis-aligned rectangle each
function areaCells(d: string): string[] {
  return pathPolylines(d).flatMap(({ points, closed }) => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const [left, right, top, bottom] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const corners = new Set(points.map(([x, y]) => `${x},${y}`));
    const square = points.every(([x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length];
      return x === nx || y === ny;
    });
    if (
      !closed ||
      points.length !== 4 ||
      corners.size !== 4 ||
      !square ||
      left === right ||
      top === bottom
    ) {
      fail(`path ${d}: not a rectangle`);
    }
    const [c0, c1, r0, r1] = [
      stitch(left, d),
      stitch(right, d),
      stitch(top, d),
      stitch(bottom, d),
    ];
    return Array.from({ length: (c1 - c0) * (r1 - r0) }, (_, i) =>
      cell(c0 + (i % (c1 - c0)), r0 + Math.floor(i / (c1 - c0)))
    );
  });
}

const DECODE: Record<Paint['path'], (d: string) => string[]> = {
  stroke: strokeCells,
  area: areaCells,
};

const paintKey = (attributes: Record<string, unknown>): string =>
  JSON.stringify(
    Object.entries(attributes)
      .filter(([key]) => key !== 'd')
      .sort()
  );

function threadOf(e: StyleElement, where: string): Thread {
  const key = paintKey(e.attributes ?? {});
  return (
    THREADS.find((t) => paintKey(PAINT[t].attributes) === key) ??
    fail(`${where}: a path painted like no thread`)
  );
}

// Decodes the emitted path data back into cells: the SVG must draw exactly the cells the other guards checked
export function checkPathCells(def: StyleDefinition, lib: Library): void {
  for (const [component, kind] of Object.entries(DRAWN)) {
    const variants = baseComponent(def, component).variants;
    if (Object.keys(variants).sort().join() !== Object.keys(lib[kind]).sort().join()) {
      fail(`${component}: variants differ from the ${kind} drawings`);
    }
    for (const [name, variant] of Object.entries(variants)) {
      const where = `${component}.${name}`;
      const drawn = new Map<Thread, string[]>();
      for (const e of variant.elements) {
        const d = e.attributes?.d;
        if (
          e.type !== 'element' ||
          e.name !== 'path' ||
          e.children ||
          typeof d !== 'string'
        ) {
          fail(`${where}: a part holds only one path per thread`);
        }
        const t = threadOf(e, where);
        if (drawn.has(t)) {
          fail(`${where}: thread ${t} has two paths`);
        }
        drawn.set(t, DECODE[PAINT[t].path](d).sort());
      }
      for (const t of THREADS) {
        const want = lib[kind][name]
          .filter((p) => p.t === t)
          .map((p) => cell(p.col, p.row))
          .sort();
        const got = (drawn.get(t) ?? []).join(' ');
        if (got !== want.join(' ')) {
          fail(
            `${where}: thread ${t} draws ${got || 'nothing'}, the drawing has ${want.join(' ') || 'nothing'}`
          );
        }
      }
    }
  }
}
