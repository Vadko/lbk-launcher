import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  millenniumDir: null as string | null,
  decky: null as null | {
    homebrewDir: string;
    plugin: {
      installed: boolean;
      dir: string | null;
      version: string | null;
      disabled: boolean;
    };
  },
}));

vi.mock('./millennium-plugin', () => ({
  millenniumPluginDataDir: () => fake.millenniumDir,
}));
vi.mock('./decky', () => ({
  DECKY_PLUGIN_DIR: 'lbk-bridge',
  detectDeckyPluginSync: () => fake.decky,
}));

const data = await import('./plugin-data');

describe('bridge plugin data files', () => {
  let root: string;
  let homebrew: string;

  const deckyPlugin = (installed: boolean) => {
    fake.decky = {
      homebrewDir: homebrew,
      plugin: {
        installed,
        dir: installed ? path.join(homebrew, 'plugins', 'lbk-bridge') : null,
        version: installed ? '1.1.0' : null,
        disabled: false,
      },
    };
  };
  const deckyData = (...parts: string[]) =>
    path.join(homebrew, 'data', 'lbk-bridge', ...parts);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-plugin-data-'));
    homebrew = path.join(root, 'homebrew');
    fake.millenniumDir = path.join(root, 'millennium');
    fs.mkdirSync(fake.millenniumDir, { recursive: true });
    fs.mkdirSync(path.join(homebrew, 'data'), { recursive: true });
    fake.decky = null;
  });
  afterEach(() => {
    data.deleteBridgePluginData('bridge.json');
    data.deleteBridgePluginData('achievements.json');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes to Millennium and to the Decky data dir of an installed plugin', () => {
    deckyPlugin(true);
    data.writeBridgePluginData('bridge.json', { v: 1, port: 5000 });
    const millennium = path.join(fake.millenniumDir as string, 'bridge.json');
    expect(JSON.parse(fs.readFileSync(millennium, 'utf8'))).toEqual({ v: 1, port: 5000 });
    expect(JSON.parse(fs.readFileSync(deckyData('bridge.json'), 'utf8')).port).toBe(5000);
    if (process.platform !== 'win32') {
      expect(fs.statSync(deckyData('bridge.json')).mode & 0o777).toBe(0o600);
    }

    data.deleteBridgePluginData('bridge.json');
    expect(fs.existsSync(millennium)).toBe(false);
    expect(fs.existsSync(deckyData('bridge.json'))).toBe(false);
  });

  it('skips Decky until the plugin is installed, then resyncs what was written', () => {
    deckyPlugin(false);
    data.writeBridgePluginData('achievements.json', { v: 1, stamp: 's', apps: {} });
    expect(fs.existsSync(deckyData())).toBe(false);

    deckyPlugin(true);
    data.resyncBridgePluginData();
    expect(
      JSON.parse(fs.readFileSync(deckyData('achievements.json'), 'utf8')).stamp
    ).toBe('s');
  });

  it('creates data/ on a fresh Decky that has not loaded any plugin yet', () => {
    deckyPlugin(true);
    fs.rmSync(path.join(homebrew, 'data'), { recursive: true });
    data.writeBridgePluginData('bridge.json', { v: 1 });
    expect(JSON.parse(fs.readFileSync(deckyData('bridge.json'), 'utf8'))).toEqual({
      v: 1,
    });
  });

  it('leaves Decky alone when its data dir cannot be created', () => {
    deckyPlugin(true);
    fs.rmSync(path.join(homebrew, 'data'), { recursive: true });
    fs.chmodSync(homebrew, 0o500);
    try {
      data.writeBridgePluginData('bridge.json', { v: 1 });
    } finally {
      fs.chmodSync(homebrew, 0o700);
    }
    expect(fs.existsSync(path.join(homebrew, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(fake.millenniumDir as string, 'bridge.json'))).toBe(
      true
    );
  });

  it('removes data files left after the plugin was uninstalled in Decky', () => {
    deckyPlugin(true);
    data.writeBridgePluginData('bridge.json', { v: 1 });
    fs.writeFileSync(deckyData('other.txt'), 'x');

    data.removeOrphanDeckyPluginData();
    expect(fs.existsSync(deckyData('bridge.json'))).toBe(true);

    deckyPlugin(false);
    data.removeOrphanDeckyPluginData();
    expect(fs.existsSync(deckyData('bridge.json'))).toBe(false);
    expect(fs.existsSync(deckyData('other.txt'))).toBe(true);
  });
});

describe('currentUserOnlyIcaclsArgs', () => {
  it('drops inherited access and grants only the signed-in account', () => {
    expect(
      data.currentUserOnlyIcaclsArgs(
        'C:\\Steam\\bridge.json',
        { USERNAME: 'vadko', USERDOMAIN: 'PC' },
        'x'
      )
    ).toEqual(['C:\\Steam\\bridge.json', '/inheritance:r', '/grant:r', 'PC\\vadko:F']);
    expect(data.currentUserOnlyIcaclsArgs('f', {}, 'vadko')).toEqual([
      'f',
      '/inheritance:r',
      '/grant:r',
      'vadko:F',
    ]);
  });
});
