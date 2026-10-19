import { A, type Option, pipe, R } from '@mobily/ts-belt';

export type BridgeScript = 'index.js' | 'webkit.js';

const DIST_PATH = '/lbk-bridge/.millennium/Dist/';
// Lazy and whitespace-bounded, not paren-free: Windows Steam lives in Program Files (x86).
const STACK_URL = /https?:\/\/\S+?\.js(?=:\d+:\d+)/g;

export const scriptPath = (file: BridgeScript): string => `${DIST_PATH}${file}`;

const isScript =
  (file: BridgeScript) =>
  (src: string): boolean =>
    R.getWithDefault(
      R.fromExecution(() => new URL(src).pathname.endsWith(scriptPath(file))),
      false
    );

// ttc emits an IIFE, so import.meta.url is not ours; Millennium injects a script tag with the full URL of the file.
const fromScriptTag = (file: BridgeScript): Option<string> =>
  pipe(
    Array.from(document.scripts),
    A.map((script) => script.src),
    A.find(isScript(file))
  );

// A loader that import()s the file leaves no tag, but the stack still names it.
const fromStack = (file: BridgeScript): Option<string> =>
  pipe(new Error().stack?.match(STACK_URL) ?? [], A.find(isScript(file)));

export const ownScriptUrl = (file: BridgeScript): Option<string> =>
  fromScriptTag(file) ?? fromStack(file);
