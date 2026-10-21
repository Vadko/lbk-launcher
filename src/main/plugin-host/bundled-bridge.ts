import * as path from 'node:path';
import type { BridgeHost } from '@lbk/bridge-core/contract';
import { app } from 'electron';

interface BundledBridgeFiles {
  pluginJson: string;
  index: string;
  // Millennium's script for Steam's web pages; Decky has no such file.
  webkit: string | null;
}

// Output of `pnpm build:bridge`; electron-builder copies each file to <resources>/<host>-plugin/lbk-bridge/.
const DEV_OUTPUT_DIR: Record<BridgeHost, string> = {
  millennium: path.join('.millennium', 'Dist'),
  decky: 'dist',
};
const HAS_WEBKIT: Record<BridgeHost, boolean> = { millennium: true, decky: false };

export function bundledBridgeFiles(host: BridgeHost): BundledBridgeFiles {
  const pkg = path.join(app.getAppPath(), 'packages', `lbk-bridge-${host}`);
  const packaged = path.join(process.resourcesPath, `${host}-plugin`, 'lbk-bridge');
  const root = app.isPackaged ? packaged : pkg;
  const output = app.isPackaged ? packaged : path.join(pkg, DEV_OUTPUT_DIR[host]);
  return {
    pluginJson: path.join(root, 'plugin.json'),
    index: path.join(output, 'index.js'),
    webkit: HAS_WEBKIT[host] ? path.join(output, 'webkit.js') : null,
  };
}
