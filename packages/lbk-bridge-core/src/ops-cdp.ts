import { createOps } from './ops';
import { steamGlobals } from './steam-globals';

// esbuild entry for the IIFE that LBK evaluates in SharedJSContext over CDP.
export const ops = createOps(steamGlobals());
