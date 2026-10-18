import type * as ChildProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MillenniumModule from '@/main/utils/millennium';
import {
  MILLENNIUM_PLUGIN_VERSION,
  STEAM_OPS_SOURCE,
} from '@/main/utils/steam-bridge-ops';

const REPO_PLUGIN_DIR = path.resolve(__dirname, '../../../resources/millennium-plugin');
const PLUGIN_INDEX = path.join(REPO_PLUGIN_DIR, 'lbk-bridge/frontend/index.js');
const PLUGIN_JSON = path.join(REPO_PLUGIN_DIR, 'lbk-bridge/plugin.json');
const DECKY_DIR = path.resolve(__dirname, '../../../resources/decky-plugin/lbk-bridge');
const DECKY_INDEX = path.join(DECKY_DIR, 'frontend/index.js');
const CORE_BEGIN = '/* @lbk-core:begin */\n';
const CORE_END = '\n/* @lbk-core:end */';

function coreOf(source: string): string {
  const start = source.indexOf(CORE_BEGIN);
  const stop = source.indexOf(CORE_END, start);
  expect(start).toBeGreaterThan(-1);
  expect(stop).toBeGreaterThan(start);
  return source.slice(start + CORE_BEGIN.length, stop);
}

async function expectValidModule(file: string): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-plugin-'));
  const tmp = path.join(dir, 'index.mjs');
  fs.copyFileSync(file, tmp);
  const real = await vi.importActual<typeof ChildProcess>('node:child_process');
  try {
    expect(() => real.execFileSync(process.execPath, ['--check', tmp])).not.toThrow();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const fake = {
  info: null as MillenniumModule.MillenniumInfo | null,
  steamRunning: false,
  psOutput: '',
};

vi.mock('@/main/utils/theme', () => ({
  resolveResource: (name: string) => path.join(REPO_PLUGIN_DIR, '..', name),
}));
vi.mock('@/main/utils/platform', () => ({
  isWindows: () => false,
  isLinux: () => false,
  isMacOS: () => true,
}));
vi.mock('@/main/utils/millennium', async (importOriginal) => {
  const actual = await importOriginal<typeof MillenniumModule>();
  return { ...actual, detectMillennium: () => fake.info };
});
vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcess>()),
  execFileSync: vi.fn((command: string) => {
    if (fake.steamRunning) {
      return command === 'ps' ? fake.psOutput : '1234\n';
    }
    throw Object.assign(new Error('no match'), { status: 1 });
  }),
}));

const plugin = await import('@/main/utils/millennium-plugin');
const pluginData = await import('@/main/utils/plugin-data');

describe('bundled plugin files', () => {
  const source = fs.readFileSync(PLUGIN_INDEX, 'utf8');

  it('carries the generated ops block', () => {
    const begin = '/* @lbk-ops:begin */\n';
    const end = '\n/* @lbk-ops:end */';
    const start = source.indexOf(begin);
    const stop = source.indexOf(end, start);
    expect(start).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(start);
    expect(source.slice(start + begin.length, stop)).toBe(
      `const OPS = ${STEAM_OPS_SOURCE};`
    );
  });

  it('has a plugin.json matching the TS contract', () => {
    const json = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
    expect(json.name).toBe(plugin.MILLENNIUM_PLUGIN_NAME);
    expect(json.version).toBe(MILLENNIUM_PLUGIN_VERSION);
    expect(json.useBackend).toBe(false);
    expect(source).toContain(`const VERSION = '${MILLENNIUM_PLUGIN_VERSION}';`);
    expect(source).toContain(`const PLUGIN = '${plugin.MILLENNIUM_PLUGIN_NAME}';`);
  });

  it('is a syntactically valid ES module', async () => {
    await expectValidModule(PLUGIN_INDEX);
  });
});

describe('bundled Decky plugin', () => {
  const millennium = fs.readFileSync(PLUGIN_INDEX, 'utf8');
  const decky = fs.readFileSync(DECKY_INDEX, 'utf8');

  it('shares the whole core with the Millennium build', () => {
    expect(coreOf(decky)).toBe(coreOf(millennium));
    expect(coreOf(millennium)).toContain('/* @lbk-ops:begin */');
    expect(millennium).toContain("const HOST = 'millennium';");
    expect(decky).toContain("const HOST = 'decky';");
    expect(decky).toContain("new URL('../data/', import.meta.url)");
  });

  it('has the manifest fields Decky reads without defaults', () => {
    const pluginJson = JSON.parse(
      fs.readFileSync(path.join(DECKY_DIR, 'plugin.json'), 'utf8')
    );
    expect(pluginJson).toEqual({ name: 'LBK Bridge', author: 'LBK Team', flags: [] });
    const pkg = JSON.parse(fs.readFileSync(path.join(DECKY_DIR, 'package.json'), 'utf8'));
    expect(pkg.version).toBe(MILLENNIUM_PLUGIN_VERSION);
    expect(pkg.type).toBe('module');
    expect(fs.existsSync(path.join(DECKY_DIR, 'main.py'))).toBe(false);
  });

  it('is an ES module with a default export', async () => {
    expect(decky).toMatch(/^export default \(\) => \{$/m);
    expect(millennium).not.toContain('export default');
    await expectValidModule(DECKY_INDEX);
  });
});

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
      installedVersion: MILLENNIUM_PLUGIN_VERSION,
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

  it('edits enabledPlugins only while Steam is off', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ plugins: { enabledPlugins: ['core'] } })
    );

    fake.steamRunning = true;
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('steam-running');
    expect(
      JSON.parse(fs.readFileSync(configPath, 'utf8')).plugins.enabledPlugins
    ).toEqual(['core']);
    expect(fs.existsSync(`${configPath}.lbk.tmp`)).toBe(false);

    fake.steamRunning = false;
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('changed');
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('unchanged');
    expect(plugin.getMillenniumPluginState().enabled).toBe(true);
    expect(plugin.setMillenniumPluginEnabledInConfig(false)).toBe('changed');
    expect(
      JSON.parse(fs.readFileSync(configPath, 'utf8')).plugins.enabledPlugins
    ).toEqual(['core']);
  });

  it("does not count Millennium's own steam_osx launcher as a running Steam", () => {
    fs.writeFileSync(configPath, JSON.stringify({ plugins: { enabledPlugins: [] } }));
    fake.steamRunning = true;
    fake.psOutput =
      '1234 /Users/u/Applications/Steam Millennium.app/Contents/MacOS/steam_osx\n';
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('changed');

    fake.psOutput =
      '1234 /Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steam_osx\n';
    expect(plugin.setMillenniumPluginEnabledInConfig(false)).toBe('steam-running');
    fake.steamRunning = false;
    fake.psOutput = '';
  });

  it('reports invalid and missing configs', () => {
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('no-config');
    fs.writeFileSync(configPath, '{ broken');
    expect(plugin.setMillenniumPluginEnabledInConfig(true)).toBe('invalid-config');
    expect(fs.readFileSync(configPath, 'utf8')).toBe('{ broken');
  });

  it('removes only its own plugin folder', () => {
    plugin.installOrUpdateMillenniumPlugin();
    plugin.removeMillenniumPluginFiles();
    expect(fs.existsSync(installed())).toBe(false);
  });
});
