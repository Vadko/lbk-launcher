import { checkCombo } from './checkCombo';
import type { ComboStats } from './comboStats';
import { compose } from './compose';
import type { Library } from './library';
import { ARMS, CORES, CORNERS, type Part } from './motifs';

interface Combo {
  readonly p: number;
  readonly stats: ComboStats;
}

const total = (parts: Record<string, Part>): number =>
  Object.values(parts).reduce((s, part) => s + (part.weight ?? 1), 0);

// Every combination, checked, with the probability DiceBear's independent weighted picks give it
export function combos(lib: Library): Combo[] {
  const [tk, ta, tx] = [total(CORES), total(ARMS), total(CORNERS)];
  const out: Combo[] = [];
  for (const [k, kp] of Object.entries(CORES)) {
    for (const [a, ap] of Object.entries(ARMS)) {
      for (const [x, xp] of Object.entries(CORNERS)) {
        const stats = checkCombo(compose(lib, k, a, x), `${k}/${a}/${x}`);
        const p =
          ((kp.weight ?? 1) / tk) * ((ap.weight ?? 1) / ta) * ((xp.weight ?? 1) / tx);
        out.push({ p, stats });
      }
    }
  }
  return out;
}
