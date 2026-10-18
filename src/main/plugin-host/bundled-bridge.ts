import * as path from 'node:path';
import type { BridgeHost } from '@lbk/bridge-core/contract';
import { app } from 'electron';

interface BundledBridgeFiles {
  pluginJson: string;
  index: string;
}

// Output of `pnpm build:bridge`; electron-builder copies each file to <resources>/<host>-plugin/lbk-bridge/.
const DEV_INDEX: Record<BridgeHost, string> = {
  millennium: path.join('.millennium', 'Dist', 'index.js'),
  decky: path.join('dist', 'index.js'),
};

export function bundledBridgeFiles(host: BridgeHost): BundledBridgeFiles {
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, `${host}-plugin`, 'lbk-bridge');
    return {
      pluginJson: path.join(dir, 'plugin.json'),
      index: path.join(dir, 'index.js'),
    };
  }
  const dir = path.join(app.getAppPath(), 'packages', `lbk-bridge-${host}`);
  return {
    pluginJson: path.join(dir, 'plugin.json'),
    index: path.join(dir, DEV_INDEX[host]),
  };
}
