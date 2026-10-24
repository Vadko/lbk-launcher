import vm from 'node:vm';
import { BRIDGE_VERSION } from '@lbk/bridge-core/contract';
import { describe, expect, it, vi } from 'vitest';
import {
  deckyArtifactUrl,
  deckyCacheDirFor,
  deckyInstallType,
  findPluginDir,
  isPluginDisabled,
  parseUnprivilegedPath,
} from './decky';
import { STEAM_OPS_SOURCE } from './steam-bridge-ops';

const loadOps = (globals: Record<string, unknown> = {}) =>
  vm.runInContext(STEAM_OPS_SOURCE, vm.createContext(globals)) as Record<
    string,
    (args: unknown) => Promise<unknown>
  >;

describe('parseUnprivilegedPath', () => {
  it('reads the homebrew dir from the systemd unit', () => {
    const unit = `[Service]
Type=simple
User=root
Environment=UNPRIVILEGED_PATH=/home/deck/homebrew
Environment=PRIVILEGED_PATH=/home/deck/homebrew
ExecStart=/home/deck/homebrew/services/PluginLoader
`;
    expect(parseUnprivilegedPath(unit)).toBe('/home/deck/homebrew');
    expect(parseUnprivilegedPath('Environment="UNPRIVILEGED_PATH=/x/hb"')).toBe('/x/hb');
    expect(parseUnprivilegedPath('[Service]\nUser=root\n')).toBeNull();
  });
});

describe('findPluginDir', () => {
  it('finds our plugin by its plugin.json name, not the folder name', () => {
    expect(
      findPluginDir([
        { dir: '/hb/plugins/a', pluginJson: { name: 'Other' } },
        { dir: '/hb/plugins/lbk-bridge', pluginJson: { name: 'LBK Bridge' } },
      ])
    ).toBe('/hb/plugins/lbk-bridge');
    expect(findPluginDir([{ dir: '/hb/plugins/x', pluginJson: null }])).toBeNull();
  });
});

describe('isPluginDisabled', () => {
  it('reads disabled_plugins from loader.json', () => {
    expect(isPluginDisabled({ disabled_plugins: ['LBK Bridge'] })).toBe(true);
    expect(isPluginDisabled({ disabled_plugins: [] })).toBe(false);
    expect(isPluginDisabled(null)).toBe(false);
  });
});

describe('deckyInstallType', () => {
  it('installs, updates an older copy and reinstalls the same or a newer one', () => {
    expect(deckyInstallType({ installed: false, version: null }, '1.1.0')).toBe(0);
    expect(deckyInstallType({ installed: true, version: '1.0.9' }, '1.1.0')).toBe(2);
    expect(deckyInstallType({ installed: true, version: null }, '1.1.0')).toBe(2);
    expect(deckyInstallType({ installed: true, version: '1.1.0' }, '1.1.0')).toBe(1);
    expect(deckyInstallType({ installed: true, version: '1.2.0' }, '1.1.0')).toBe(1);
  });
});

describe('deckyArtifactUrl', () => {
  it('produces exactly what the deckyRequestInstall op accepts', async () => {
    const call = vi.fn(() => Promise.resolve(undefined));
    const ops = loadOps({ window: { DeckyBackend: { call } } });
    const cases = [
      deckyCacheDirFor('/home/deck', undefined),
      deckyCacheDirFor('/var/home/user.name', undefined),
      deckyCacheDirFor('/home/deck', 'ua.lbk.Launcher'),
    ];
    expect(cases[0]).toBe('/home/deck/.cache/lbk-launcher/decky');
    expect(cases[2]).toBe('/home/deck/.var/app/ua.lbk.Launcher/cache/lbk-launcher/decky');
    for (const dir of cases) {
      const artifact = deckyArtifactUrl(dir, BRIDGE_VERSION);
      expect(artifact.startsWith('file:///')).toBe(true);
      await expect(
        ops.deckyRequestInstall({
          artifact,
          version: BRIDGE_VERSION,
          hash: 'f'.repeat(64),
          installType: 0,
        })
      ).resolves.toBe('prompted');
    }
  });
});

describe('deckyRequestInstall', () => {
  const HASH = 'a'.repeat(64);
  const CACHE = 'file:///home/deck/.cache/lbk-launcher/decky';
  const valid = {
    artifact: `${CACHE}/lbk-bridge-1.1.0.zip`,
    version: '1.1.0',
    hash: HASH,
    installType: 0,
  };

  function withDecky() {
    const call = vi.fn((..._args: unknown[]) => Promise.resolve(undefined));
    return { call, ops: loadOps({ window: { DeckyBackend: { call } } }) };
  }

  it('asks Decky to show its own install prompt', async () => {
    const { call, ops } = withDecky();
    await expect(ops.deckyRequestInstall(valid)).resolves.toBe('prompted');
    expect(call).toHaveBeenCalledWith(
      'utilities/install_plugin',
      valid.artifact,
      'LBK Bridge',
      '1.1.0',
      HASH,
      0
    );
  });

  it.each([
    ['invalid artifact', { artifact: 'https://example.com/lbk-bridge-1.1.0.zip' }],
    ['invalid artifact', { artifact: `${CACHE}/lbk-bridge-1.0.0.zip` }],
    [
      'invalid artifact',
      { artifact: 'file:///home/../root/.cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip' },
    ],
    ['invalid artifact', { artifact: `${CACHE}/../../evil/lbk-bridge-1.1.0.zip` }],
    ['invalid artifact', { artifact: 'file:///etc/lbk-bridge-1.1.0.zip' }],
    ['invalid artifact', { artifact: `${CACHE}/lbk-bridge-1.1.0.zip?x` }],
    [
      'invalid artifact',
      {
        artifact:
          'file:///home/deck/.var/app/../cache/lbk-launcher/decky/lbk-bridge-1.1.0.zip',
      },
    ],
    ['invalid version', { version: '1.1' }],
    ['invalid hash', { hash: 'A'.repeat(64) }],
    ['invalid hash', { hash: HASH.slice(1) }],
    ['invalid int', { installType: 3 }],
    ['invalid int', { installType: -1 }],
    ['invalid int', { installType: 1.5 }],
    ['invalid int', { installType: '0' }],
  ])('fails with "%s" for %j without calling Decky', async (error, change) => {
    const { call, ops } = withDecky();
    await expect(ops.deckyRequestInstall({ ...valid, ...change })).rejects.toThrow(
      `lbk-ops: ${error}`
    );
    expect(call).not.toHaveBeenCalled();
  });

  it('answers no-decky when Decky is not injected', async () => {
    await expect(loadOps().deckyRequestInstall(valid)).resolves.toBe('no-decky');
    await expect(loadOps({ window: {} }).deckyRequestInstall(valid)).resolves.toBe(
      'no-decky'
    );
  });
});
