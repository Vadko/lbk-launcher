import { browserEnv, createBridge } from '@lbk/bridge-core/bridge';

const ENTRY_PATH = '/lbk-bridge/.millennium/Dist/index.js';
const ENTRY_IN_STACK = /(https?:\/\/[^\s()]+\/lbk-bridge\/\.millennium\/Dist\/index\.js)/;

// ttc emits an IIFE, so import.meta.url is not ours; Millennium injects a script tag with the full URL of this file.
function ownScriptUrl(): string | null {
  for (const script of Array.from(document.scripts)) {
    if (script.src && new URL(script.src).pathname.endsWith(ENTRY_PATH)) {
      return script.src;
    }
  }
  // A loader that import()s the file leaves no tag, but the stack still names it.
  return ENTRY_IN_STACK.exec(new Error().stack ?? '')?.[1] ?? null;
}

export default function PluginMain(): void {
  const url = ownScriptUrl();
  if (!url) {
    console.warn(
      `[LBK] No script tag ends with ${ENTRY_PATH}; bridge.json cannot be found`
    );
    return;
  }
  // bridge.json and achievements.json are written next to this file.
  createBridge({
    host: 'millennium',
    dataBase: new URL('./', url),
    env: browserEnv(),
  }).start();
}
