import type { StyleDefinition } from '@dicebear/core';
import { checkOrnaments } from './checkOrnaments';
import { checkPathCells } from './checkPathCells';
import { checkWiring } from './checkWiring';
import type { Library } from './library';

// Every guard on the emitted definition: its wiring, the ornaments around the quarter and the cells its paths draw
export function checkDefinition(def: StyleDefinition, lib: Library): void {
  checkWiring(def);
  checkOrnaments(def);
  checkPathCells(def, lib);
}
