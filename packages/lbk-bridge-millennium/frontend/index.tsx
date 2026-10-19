import { browserEnv, createBridge } from '@lbk/bridge-core/bridge';
import { O } from '@mobily/ts-belt';
import { ownScriptUrl, scriptPath } from '../shared/own-script-url';

export default function PluginMain(): void {
  O.match(
    ownScriptUrl('index.js'),
    // bridge.json and achievements.json are written next to this file.
    (url) =>
      createBridge({
        host: 'millennium',
        dataBase: new URL('./', url),
        env: browserEnv(),
      }).start(),
    () =>
      console.warn(
        `[LBK] No script tag ends with ${scriptPath('index.js')}; bridge.json cannot be found`
      )
  );
}
