import type { ComboStats } from './comboStats';
import { fail } from './fail';

// Weight-mass ceilings at 24 px: dense combinations turn to mush, busy colour changes and lone stitches to confetti
const GATES = [
  { name: 'dense (fill > 70%)', limit: 0.05, bad: (s: ComboStats) => s.density > 0.7 },
  {
    name: 'busy (colour changes > 75%)',
    limit: 0.02,
    bad: (s: ComboStats) => s.edge > 0.75,
  },
  {
    name: 'speckled (lone stitches > 65%)',
    limit: 0.03,
    bad: (s: ComboStats) => s.lone > 0.65,
  },
] as const;

export function checkGates(
  all: ReadonlyArray<{ readonly p: number; readonly stats: ComboStats }>
): void {
  for (const gate of GATES) {
    const mass = all.filter((c) => gate.bad(c.stats)).reduce((s, c) => s + c.p, 0);
    if (mass > gate.limit) {
      fail(
        `gate ${gate.name}: ${(100 * mass).toFixed(1)}% of the weight mass, limit ${100 * gate.limit}%`
      );
    }
  }
}
