// still: animations are off, all lit; idle: pairs trade places; chase: lights run round; win: neighbours flash in turn
export type BulbMode = 'still' | 'idle' | 'chase' | 'win';

export interface BulbSpot {
  // Fractions of the track through the bulb centres
  x: number;
  y: number;
}

export interface BulbTiming {
  periodMs: number;
  // Negative, so every bulb starts mid-cycle and the pattern is there on the first frame
  delayMs: number;
}

const CHASE_STEP_MS = 110;
const CHASE_GROUP = 3;
const TWINKLE_MS = 2400;
const FLASH_MS = 240;

const fractions = (count: number) =>
  Array.from({ length: count }, (_, index) => index / (count - 1));

// Clockwise from the top-left corner, each corner once
export function bulbFrame(columns: number, rows: number): BulbSpot[] {
  const across = fractions(columns);
  const down = fractions(rows).slice(1, -1);
  return [
    ...across.map((x) => ({ x, y: 0 })),
    ...down.map((y) => ({ x: 1, y })),
    ...across.map((x) => ({ x: 1 - x, y: 1 })),
    ...down.map((y) => ({ x: 0, y: 1 - y })),
  ];
}

export function bulbTiming(index: number, mode: BulbMode): BulbTiming {
  if (mode === 'chase') {
    return {
      periodMs: CHASE_STEP_MS * CHASE_GROUP,
      delayMs: -((CHASE_GROUP - (index % CHASE_GROUP)) % CHASE_GROUP) * CHASE_STEP_MS,
    };
  }
  if (mode === 'idle') {
    return {
      periodMs: TWINKLE_MS,
      delayMs: Math.floor(index / 2) % 2 === 0 ? 0 : -TWINKLE_MS / 2,
    };
  }
  if (mode === 'win') {
    // Half the bulbs are always lit, so the machine never looks switched off as it pays
    return { periodMs: FLASH_MS, delayMs: index % 2 === 0 ? 0 : -FLASH_MS / 2 };
  }
  return { periodMs: FLASH_MS, delayMs: 0 };
}
