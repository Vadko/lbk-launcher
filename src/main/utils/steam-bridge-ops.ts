import opsIife from '@lbk/bridge-core/steam-ops.iife.js?raw';

// One expression, so steam-cef.ts can index it; the arrow keeps esbuild's `var __lbkOps` off Steam's window.
export const STEAM_OPS_SOURCE = `(() => {\n${opsIife}\nreturn __lbkOps.ops;\n})()`;
