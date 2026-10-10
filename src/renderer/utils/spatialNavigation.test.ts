import { describe, expect, it } from 'vitest';
import { findNextInDirection } from './spatialNavigation';

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const pick = (
  from: ReturnType<typeof box>,
  items: Record<string, ReturnType<typeof box>>,
  dir: Parameters<typeof findNextInDirection>[2]
) =>
  findNextInDirection(
    from,
    Object.entries(items).map(([item, b]) => ({ item, box: b })),
    dir
  );

describe('findNextInDirection', () => {
  // Three-column card grid with a "view all" button above the right column
  const grid = {
    viewAll: box(1500, 0, 150, 40),
    a1: box(0, 100, 400, 300),
    b1: box(500, 100, 400, 300),
    c1: box(1000, 100, 400, 300),
    a2: box(0, 500, 400, 300),
    b2: box(500, 500, 400, 300),
    c2: box(1000, 500, 400, 300),
  };

  it('moves to the item directly below in a grid', () => {
    expect(pick(grid.a1, grid, 'down')).toBe('a2');
    expect(pick(grid.b1, grid, 'down')).toBe('b2');
  });

  it('moves along a row and stops at its edge', () => {
    expect(pick(grid.a1, grid, 'right')).toBe('b1');
    expect(pick(grid.b2, grid, 'left')).toBe('a2');
    expect(pick(grid.a1, grid, 'left')).toBeNull();
  });

  it('does not treat items on the same row as up/down targets', () => {
    expect(pick(grid.b1, { a1: grid.a1, c1: grid.c1 }, 'down')).toBeNull();
    expect(pick(grid.b1, { a1: grid.a1, c1: grid.c1 }, 'up')).toBeNull();
  });

  it('reaches an off-axis item when nothing is in line', () => {
    expect(pick(grid.c1, grid, 'up')).toBe('viewAll');
    expect(pick(grid.viewAll, grid, 'down')).toBe('c1');
  });

  it('prefers an in-line item over a closer one off to the side', () => {
    const from = box(0, 0, 200, 50);
    const items = {
      farRight: box(1200, 80, 200, 50),
      wideBelow: box(0, 200, 1400, 80),
    };
    expect(pick(from, items, 'down')).toBe('wideBelow');
  });

  it('leaves a full-width block for the first item of the next row', () => {
    const banner = box(0, 0, 1400, 90);
    const row = { first: box(0, 200, 400, 300), middle: box(500, 200, 400, 300) };
    expect(pick(banner, row, 'down')).toBe('first');
  });

  it('treats slightly misaligned flex items as the same row', () => {
    const tall = box(0, 0, 200, 60);
    const short = box(220, 10, 120, 40);
    expect(pick(tall, { short }, 'right')).toBe('short');
    expect(pick(tall, { short }, 'down')).toBeNull();
  });
});
