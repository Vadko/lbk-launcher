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
    const ops = vm.runInContext(
      STEAM_OPS_SOURCE,
      vm.createContext({ window: { DeckyBackend: { call } } })
    ) as Record<string, (args: unknown) => Promise<unknown>>;
    const cases = [
      deckyCacheDirFor('/home/deck', undefined),
      deckyCacheDirFor('/var/home/vadko', undefined),
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
