import { type Placed, UNIT } from './grid';

// Fill path: runs on a row merge into rectangles, which grow downward while the next row repeats them
export function areaPath(cells: Placed[]): string {
  const rows = new Map<number, number[]>();
  for (const p of cells) {
    rows.set(p.row, [...(rows.get(p.row) ?? []), p.col]);
  }
  const runs: Array<[number, number, number, number]> = [];
  for (const [row, cols] of [...rows].sort((a, b) => a[0] - b[0])) {
    const sorted = [...new Set(cols)].sort((a, b) => a - b);
    let start = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        const width = sorted[i - 1] - start + 1;
        const above = runs.find(
          (rect) => rect[0] === start && rect[2] === width && rect[1] + rect[3] === row
        );
        if (above) {
          above[3] += 1;
        } else {
          runs.push([start, row, width, 1]);
        }
        start = sorted[i];
      }
    }
  }
  let d = '';
  let px = 0;
  let py = 0;
  let first = true;
  for (const [col, row, w, h] of runs) {
    const x = col * UNIT;
    const y = row * UNIT;
    const abs = `M${x} ${y}`;
    const rel = `m${x - px} ${y - py}`.replace(' -', '-');
    d += first || abs.length <= rel.length ? abs : rel;
    d += `h${w * UNIT}v${h * UNIT}h-${w * UNIT}z`;
    px = x;
    py = y;
    first = false;
  }
  return d;
}

// Stroke path: one-cell-high horizontal runs, drawn with a stroke as wide as a cell
export function strokePath(cells: Placed[]): string {
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const runs: Array<[number, number, number]> = [];
  for (const p of sorted) {
    const last = runs.at(-1);
    if (last && last[1] === p.row && last[0] + last[2] === p.col) {
      last[2] += 1;
    } else {
      runs.push([p.col, p.row, 1]);
    }
  }
  let d = '';
  let px = 0;
  let py = 0;
  runs.forEach(([col, row, w], i) => {
    const x = col * UNIT;
    const y = row * UNIT + UNIT / 2;
    const abs = `M${x} ${y}`;
    const rel = `m${x - px} ${y - py}`.replace(' -', '-');
    d += i === 0 || abs.length <= rel.length ? abs : rel;
    d += `h${w * UNIT}`;
    px = x + w * UNIT;
    py = y;
  });
  return d;
}
