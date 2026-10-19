import { browserEnv, createBridge } from '@lbk/bridge-core/bridge';
import { A, O, type Option, pipe } from '@mobily/ts-belt';

const ENTRY_PATH = '/lbk-bridge/.millennium/Dist/index.js';
// Lazy and whitespace-bounded, not paren-free: Windows Steam lives in Program Files (x86).
const ENTRY_IN_STACK = /(https?:\/\/\S+?\/lbk-bridge\/\.millennium\/Dist\/index\.js)/;

// ttc emits an IIFE, so import.meta.url is not ours; Millennium injects a script tag with the full URL of this file.
const fromScriptTag = (): Option<string> =>
  pipe(
    Array.from(document.scripts),
    A.map((script) => script.src),
    A.find((src) => src !== '' && new URL(src).pathname.endsWith(ENTRY_PATH))
  );

// A loader that import()s the file leaves no tag, but the stack still names it.
const fromStack = (): Option<string> =>
  O.fromNullable(ENTRY_IN_STACK.exec(new Error().stack ?? '')?.[1]);

const ownScriptUrl = (): Option<string> => fromScriptTag() ?? fromStack();

export default function PluginMain(): void {
  O.match(
    ownScriptUrl(),
    // bridge.json and achievements.json are written next to this file.
    (url) =>
      createBridge({
        host: 'millennium',
        dataBase: new URL('./', url),
        env: browserEnv(),
      }).start(),
    () =>
      console.warn(
        `[LBK] No script tag ends with ${ENTRY_PATH}; bridge.json cannot be found`
      )
  );
}
