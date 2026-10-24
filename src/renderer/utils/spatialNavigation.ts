export type Direction = 'up' | 'down' | 'left' | 'right';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// An in-line target beats a slightly closer one sitting off to the side
const ORTHOGONAL_WEIGHT = 2;
// Flex-wrap rows are rarely pixel-exact, so a small overlap still counts as the next row
const OVERLAP_TOLERANCE = 0.3;

const gapBetween = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, bStart - aEnd, aStart - bEnd);

function isInDirection(from: Box, to: Box, direction: Direction): boolean {
  const vertical = direction === 'up' || direction === 'down';
  const fromSize = vertical ? from.bottom - from.top : from.right - from.left;
  const toSize = vertical ? to.bottom - to.top : to.right - to.left;
  const tolerance = Math.min(fromSize, toSize) * OVERLAP_TOLERANCE;

  switch (direction) {
    case 'down':
      return to.top >= from.bottom - tolerance && to.bottom > from.bottom;
    case 'up':
      return to.bottom <= from.top + tolerance && to.top < from.top;
    case 'right':
      return to.left >= from.right - tolerance && to.right > from.right;
    case 'left':
      return to.right <= from.left + tolerance && to.left < from.left;
  }
}

function directionalDistance(from: Box, to: Box, direction: Direction): number {
  const vertical = direction === 'up' || direction === 'down';
  const primary = vertical
    ? gapBetween(from.top, from.bottom, to.top, to.bottom)
    : gapBetween(from.left, from.right, to.left, to.right);
  const orthogonal = vertical
    ? gapBetween(from.left, from.right, to.left, to.right)
    : gapBetween(from.top, from.bottom, to.top, to.bottom);
  // Tie-break on the start edge: leaving a wide block lands on the first item of the next row
  const startOffset = vertical
    ? Math.abs(from.left - to.left)
    : Math.abs(from.top - to.top);

  return primary + orthogonal * ORTHOGONAL_WEIGHT + startOffset * 0.01;
}

export function findNextInDirection<T>(
  from: Box,
  candidates: ReadonlyArray<{ item: T; box: Box }>,
  direction: Direction
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const { item, box } of candidates) {
    if (!isInDirection(from, box, direction)) {
      continue;
    }
    const score = directionalDistance(from, box, direction);
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
