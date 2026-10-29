import { chiralFigures } from './chiralFigures';
import { type ComboStats, comboStats } from './comboStats';
import { fail } from './fail';
import { mirrorH, mirrorV, sameGrid } from './grid';

// Rejects any composition that lost its mirror axes or holds a rotation-only figure
export function checkCombo(grid: string[][], label: string): ComboStats {
  const rows = grid.map((row) => row.join(''));
  if (!sameGrid(rows, mirrorH(rows)) || !sameGrid(rows, mirrorV(rows))) {
    fail(`${label}: composition lost its mirror axes`);
  }
  const chiral = chiralFigures(grid);
  if (chiral.length > 0) {
    fail(`${label}: rotation-only ${chiral[0]}`);
  }
  return comboStats(grid);
}
