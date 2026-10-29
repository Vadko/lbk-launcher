import { compose } from './compose';
import { fail } from './fail';
import { region } from './grid';
import { EXPECTED, type Library, ORIGIN, type PartKind } from './library';
import { ARMS, CORES, CORNERS, type Part } from './motifs';

// The quarter slices plus mirrors must give back every drawn grid stitch for stitch
export function checkReproduction(lib: Library): void {
  const firstCore = Object.keys(CORES)[0];
  const cases: ReadonlyArray<
    readonly [PartKind, Record<string, Part>, (name: string) => string[][]]
  > = [
    ['core', CORES, (name) => compose(lib, name, 'stub', 'none')],
    ['arm', ARMS, (name) => compose(lib, firstCore, name, 'none')],
    ['corner', CORNERS, (name) => compose(lib, firstCore, 'stub', name)],
  ];
  for (const [kind, parts, build] of cases) {
    const [c0, r0] = ORIGIN[kind];
    for (const [name, part] of Object.entries(parts)) {
      const grid = build(name);
      part.grid.forEach((line, r) => {
        [...line].forEach((ch, c) => {
          const got = grid[r0 + r][c0 + c];
          if (region(c0 + c, r0 + r) === EXPECTED[kind] && got !== ch) {
            fail(`${kind} ${name}: composed ${got} at ${c0 + c},${r0 + r}, drawn ${ch}`);
          }
        });
      });
    }
  }
}
