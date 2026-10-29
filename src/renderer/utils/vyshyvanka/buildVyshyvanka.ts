import { Style } from '@dicebear/core';
import { buildDefinition } from './buildDefinition';
import { checkDefinition } from './checkDefinition';
import { checkGates } from './checkGates';
import { checkPalettes } from './checkPalettes';
import { checkReproduction } from './checkReproduction';
import { chiralitySelfTest } from './chiralitySelfTest';
import { combos } from './combos';
import { definitionSelfTest } from './definitionSelfTest';
import { library } from './library';

// Runs every guard and only then returns the style JSON; any failed guard throws and nothing is written
export function buildVyshyvanka(): string {
  const lib = library();
  checkReproduction(lib);
  chiralitySelfTest(lib);
  definitionSelfTest(lib);
  checkGates(combos(lib));
  checkPalettes();
  const def = buildDefinition(lib);
  checkDefinition(def, lib);
  // DiceBear validates the definition against its JSON schema here
  new Style(def);
  return `${JSON.stringify(def, null, 2)}\n`;
}
