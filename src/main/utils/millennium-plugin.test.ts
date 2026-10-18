import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BRIDGE_VERSION } from '@lbk/bridge-core/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MillenniumModule from '@/main/utils/millennium';

const PACKAGE_DIR = path.resolve(__dirname, '../../../packages/lbk-bridge-millennium');
const PLUGIN_INDEX = path.join(PACKAGE_DIR, '.millennium/Dist/index.js');

const fake = {
  info: null as MillenniumModule.MillenniumInfo | null,
  steamRunning: false,
};

vi.mock('@/main/plugin-host/bundled-bridge', () => ({
  bundledBridgeFiles: () => ({
    pluginJson: path.join(PACKAGE_DIR, 'plugin.json'),
    index: PLUGIN_INDEX,
  }),
}));
vi.mock('@/main/utils/platform', () => ({
  isWindows: () => false,
  isLinux: () => false,
  isMacOS: () => true,
}));
vi.mock('@/main/steam-process/lifecycle', () => ({
  isSteamStopped: () => Promise.resolve(!fake.steamRunning),
}));
vi.mock('@/main/utils/millennium', async (importOriginal) => {
  const actual = await importOriginal<typeof MillenniumModule>();
  return { ...actual, detectMillennium: () => fake.info };
});
vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const plugin = await import('@/main/utils/millennium-plugin');
const pluginData = await import('@/main/utils/plugin-data');

describe('plugin install and data files', () => {
  let root: string;
  let pluginsDir: string;
  let configPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-millennium-'));
    pluginsDir = path.join(root, 'Millennium', 'plugins');
    configPath = path.join(root, 'Millennium', 'config.json');
    fs.mkdirSync(path.dirname(pluginsDir), { recursive: true });
    fake.steamRunning = false;
    fake.info = {
      installed: true,
      generation: 'v3',
      blocksTcpCdp: false,
      pluginsDir,
      configPath,
      evidence: [],
    };
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    pluginData.deleteBridgePluginData('bridge.json');
    pluginData.deleteBridgePluginData('achievements.json');
  });

  const installed = (...parts: string[]) => path.join(pluginsDir, 'lbk-bridge', ...parts);

  it('installs into .millennium/Dist and is idempotent', () => {
    expect(plugin.installOrUpdateMillenniumPlugin()).toEqual({ ok: true, changed: true });
    expect(fs.readFileSync(installed('.millennium/Dist/index.js'), 'utf8')).toBe(
      fs.readFileSync(PLUGIN_INDEX, 'utf8')
    );
    expect(plugin.installOrUpdateMillenniumPlugin()).toEqual({
      ok: true,
      changed: false,
    });
    expect(fs.readdirSync(pluginsDir)).toEqual(['lbk-bridge']);

    const state = plugin.getMillenniumPluginState();
    expect(state).toMatchObject({
      supported: true,
      installed: true,
      installedVersion: BRIDGE_VERSION,
      enabled: false,
    });
  });

  it('removes a copy a crash left mid-swap even when already up to date', () => {
    plugin.installOrUpdateMillenniumPlugin();
    const stale = path.join(pluginsDir, 'lbk-bridge.lbk-new');
    fs.mkdirSync(stale);
    fs.copyFileSync(installed('plugin.json'), path.join(stale, 'plugin.json'));
    expect(plugin.installOrUpdateMillenniumPlugin()).toEqual({
      ok: true,
      changed: false,
    });
    expect(fs.readdirSync(pluginsDir)).toEqual(['lbk-bridge']);
  });

  it('refuses without Millennium v3', () => {
    fake.info = { ...(fake.info as MillenniumModule.MillenniumInfo), generation: 'v2' };
    expect(plugin.installOrUpdateMillenniumPlugin().ok).toBe(false);
  });

  it('never takes over a foreign folder of the same name', () => {
    fs.mkdirSync(installed(), { recursive: true });
    fs.writeFileSync(installed('plugin.json'), JSON.stringify({ name: 'someone-else' }));
    expect(plugin.installOrUpdateMillenniumPlugin().ok).toBe(false);
    plugin.removeMillenniumPluginFiles();
    expect(fs.existsSync(installed('plugin.json'))).toBe(true);
  });

  it('writes data files privately and keeps them across updates', () => {
    pluginData.writeBridgePluginData('bridge.json', { v: 1, port: 5000, secret: 'a' });
    expect(plugin.millenniumPluginDataDir()).toBeNull();
    plugin.installOrUpdateMillenniumPlugin();
    pluginData.resyncBridgePluginData();
    const bridge = installed('.millennium/Dist/bridge.json');
    expect(JSON.parse(fs.readFileSync(bridge, 'utf8')).port).toBe(5000);
    if (process.platform !== 'win32') {
      expect(fs.statSync(bridge).mode & 0o777).toBe(0o600);
    }

    pluginData.writeBridgePluginData('achievements.json', { v: 1, stamp: 's', apps: {} });
    fs.writeFileSync(installed('.millennium/Dist/index.js'), '// stale');
    expect(plugin.installOrUpdateMillenniumPlugin()).toEqual({ ok: true, changed: true });
    expect(fs.existsSync(bridge)).toBe(true);
    expect(fs.existsSync(installed('.millennium/Dist/achievements.json'))).toBe(true);

    pluginData.deleteBridgePluginData('bridge.json');
    expect(fs.existsSync(bridge)).toBe(false);
  });

  it('edits enabledPlugins only while Steam is off', async () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ plugins: { enabledPlugins: ['core'] } })
    );

    fake.steamRunning = true;
    expect(await plugin.setMillenniumPluginEnabledInConfig(true)).toBe('steam-running');
    expect(
      JSON.parse(fs.readFileSync(configPath, 'utf8')).plugins.enabledPlugins
    ).toEqual(['core']);
    expect(fs.existsSync(`${configPath}.lbk.tmp`)).toBe(false);

    fake.steamRunning = false;
    expect(await plugin.setMillenniumPluginEnabledInConfig(true)).toBe('changed');
    expect(await plugin.setMillenniumPluginEnabledInConfig(true)).toBe('unchanged');
    expect(plugin.getMillenniumPluginState().enabled).toBe(true);
    expect(await plugin.setMillenniumPluginEnabledInConfig(false)).toBe('changed');
    expect(
      JSON.parse(fs.readFileSync(configPath, 'utf8')).plugins.enabledPlugins
    ).toEqual(['core']);
  });

  it('reports invalid and missing configs', async () => {
    expect(await plugin.setMillenniumPluginEnabledInConfig(true)).toBe('no-config');
    fs.writeFileSync(configPath, '{ broken');
    expect(await plugin.setMillenniumPluginEnabledInConfig(true)).toBe('invalid-config');
    expect(fs.readFileSync(configPath, 'utf8')).toBe('{ broken');
  });

  it('removes only its own plugin folder', () => {
    plugin.installOrUpdateMillenniumPlugin();
    plugin.removeMillenniumPluginFiles();
    expect(fs.existsSync(installed())).toBe(false);
  });
});
