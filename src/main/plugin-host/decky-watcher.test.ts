import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopDeckyWatcher, watchDeckyPlugins } from './decky-watcher';

const decky = vi.hoisted(() => ({ homebrewDir: null as string | null }));
const mocks = vi.hoisted(() => ({
  resetDeckyDetectCache: vi.fn(),
  syncBridgePluginSetup: vi.fn(),
  publishPluginHostState: vi.fn(),
}));

vi.mock('@/main/utils/decky', () => ({
  detectDeckyPluginSync: () =>
    decky.homebrewDir
      ? {
          homebrewDir: decky.homebrewDir,
          plugin: { installed: true, dir: null, version: null, disabled: false },
        }
      : null,
  resetDeckyDetectCache: mocks.resetDeckyDetectCache,
}));
vi.mock('@/main/utils/cef-flag-file', () => ({
  syncBridgePluginSetup: mocks.syncBridgePluginSetup,
}));
vi.mock('@/main/millennium-install', () => ({
  publishPluginHostState: mocks.publishPluginHostState,
}));

// Longer than the watcher's 500 ms debounce
const settle = () => new Promise((resolve) => setTimeout(resolve, 1000));
// macOS FSEvents starts delivering a moment after fs.watch() returns
const watchReady = () => new Promise((resolve) => setTimeout(resolve, 200));

let root: string;
const pluginDir = () => path.join(root, 'plugins', 'lbk-bridge');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-decky-'));
  fs.mkdirSync(pluginDir(), { recursive: true });
  fs.mkdirSync(path.join(root, 'settings'));
  decky.homebrewDir = root;
  vi.clearAllMocks();
});

afterEach(() => {
  stopDeckyWatcher();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('watchDeckyPlugins', () => {
  it('refreshes the host state as soon as Decky deletes a plugin folder', async () => {
    watchDeckyPlugins();
    await watchReady();
    fs.rmSync(pluginDir(), { recursive: true });
    await settle();
    expect(mocks.resetDeckyDetectCache).toHaveBeenCalled();
    expect(mocks.syncBridgePluginSetup).toHaveBeenCalledTimes(1);
    expect(mocks.publishPluginHostState).toHaveBeenCalledTimes(1);
  });

  it('follows the disabled-plugins list Decky keeps in settings', async () => {
    watchDeckyPlugins();
    await watchReady();
    fs.writeFileSync(
      path.join(root, 'settings', 'loader.json'),
      '{"disabled_plugins":["LBK Bridge"]}'
    );
    await settle();
    expect(mocks.publishPluginHostState).toHaveBeenCalledTimes(1);
  });

  it('watches nothing without Decky and starts once a later call finds it', async () => {
    decky.homebrewDir = null;
    watchDeckyPlugins();
    await watchReady();
    fs.rmSync(pluginDir(), { recursive: true });
    await settle();
    expect(mocks.publishPluginHostState).not.toHaveBeenCalled();

    decky.homebrewDir = root;
    watchDeckyPlugins();
    await watchReady();
    fs.mkdirSync(pluginDir());
    await settle();
    expect(mocks.publishPluginHostState).toHaveBeenCalledTimes(1);
  });
});
