import { describe, expect, it } from 'vitest';
import {
  type AchievementsFacts,
  computeAchievementsBadge,
  deckyLoaderOffer,
  deliveryFromBadge,
  evaluateMillenniumSupport,
  type HostFacts,
  pickPluginHost,
  steamTypeFromPath,
} from './support';

const linuxDesktop = (
  overrides: Partial<NonNullable<HostFacts['linux']>> = {}
): HostFacts => ({
  os: 'linux',
  arch: 'x64',
  steamPath: '/home/u/.local/share/Steam',
  millenniumGeneration: null,
  releaseAvailable: true,
  macos: null,
  linux: {
    steamType: 'native',
    steamOS: false,
    systemMillennium: false,
    deckyInstalled: false,
    nixos: false,
    homeLinkOk: true,
    rt64: false,
    libssl32: true,
    ...overrides,
  },
});

const windows = (overrides: Partial<HostFacts> = {}): HostFacts => ({
  os: 'windows',
  arch: 'x64',
  steamPath: 'C:\\Steam',
  millenniumGeneration: null,
  releaseAvailable: true,
  macos: null,
  linux: null,
  ...overrides,
});

const mac = (darwin: [number, number], releaseAvailable = true): HostFacts => ({
  os: 'macos',
  arch: 'x64',
  steamPath: '/Users/u/Library/Application Support/Steam',
  millenniumGeneration: null,
  releaseAvailable,
  macos: { darwin },
  linux: null,
});

describe('evaluateMillenniumSupport', () => {
  it.each([
    [linuxDesktop(), null],
    [linuxDesktop({ steamType: 'flatpak' }), 'flatpak-steam'],
    [linuxDesktop({ steamType: 'snap' }), 'snap-steam'],
    [linuxDesktop({ steamOS: true }), 'steamos'],
    [linuxDesktop({ deckyInstalled: true }), 'decky-present'],
    [linuxDesktop({ nixos: true }), 'nixos'],
    [linuxDesktop({ homeLinkOk: false }), 'steam-home-link'],
    [linuxDesktop({ rt64: true }), 'steam-rt64'],
    [linuxDesktop({ libssl32: false }), 'missing-libssl32'],
    [{ ...linuxDesktop(), arch: 'arm64' }, 'arch'],
    [{ ...linuxDesktop(), steamPath: null }, 'no-steam'],
    [windows(), null],
    [windows({ millenniumGeneration: 'v2' }), 'millennium-v2'],
    [windows({ steamPath: null }), 'no-steam'],
    [windows({ releaseAvailable: false }), 'no-release'],
    [mac([22, 3]), 'macos-too-old'],
    [mac([22, 4]), null],
    [mac([25, 0], false), 'no-release'],
  ] as const)('%#: reason %s', (facts, reason) => {
    const support = evaluateMillenniumSupport(facts);
    expect(support.reason).toBe(reason);
    expect(support.supported).toBe(reason === null);
  });

  it('lets an existing NixOS Millennium through to the plugin', () => {
    const facts = {
      ...linuxDesktop({ nixos: true }),
      millenniumGeneration: 'v3' as const,
    };
    expect(evaluateMillenniumSupport(facts).reason).toBeNull();
  });
});

describe('pickPluginHost', () => {
  const host = (f: HostFacts) => pickPluginHost(f, evaluateMillenniumSupport(f));

  it('prefers Decky over everything on Linux, and on SteamOS without Decky', () => {
    expect(host(linuxDesktop({ deckyInstalled: true }))).toBe('decky');
    expect(
      host({ ...linuxDesktop({ deckyInstalled: true }), millenniumGeneration: 'v3' })
    ).toBe('decky');
    expect(host(linuxDesktop({ steamOS: true }))).toBe('decky');
  });

  it('uses Millennium when it is supported or already installed', () => {
    expect(host(linuxDesktop())).toBe('millennium');
    expect(
      host({ ...linuxDesktop({ steamType: 'flatpak' }), millenniumGeneration: 'v3' })
    ).toBe('millennium');
    expect(host(linuxDesktop({ steamType: 'flatpak' }))).toBe('none');
    expect(host(mac([21, 0]))).toBe('none');
  });
});

describe('deckyLoaderOffer', () => {
  const offer = (overrides: Partial<Parameters<typeof deckyLoaderOffer>[0]> = {}) =>
    deckyLoaderOffer({
      host: 'decky',
      deckyInstalled: false,
      gamescope: false,
      installing: false,
      ...overrides,
    });

  it('offers the installer only where Decky is the host and missing', () => {
    expect(offer()).toEqual({ installing: false, blockedBy: null });
    expect(offer({ host: 'millennium' })).toBeNull();
    expect(offer({ host: 'none' })).toBeNull();
    expect(offer({ deckyInstalled: true })).toBeNull();
  });

  it('blocks the zenity-driven installer in Game Mode', () => {
    expect(offer({ gamescope: true })).toEqual({
      installing: false,
      blockedBy: 'game-mode',
    });
  });

  it('keeps reporting a running install after PluginLoader appears mid-run', () => {
    expect(offer({ deckyInstalled: true, installing: true })).toEqual({
      installing: true,
      blockedBy: null,
    });
  });
});

const facts = (overrides: Partial<AchievementsFacts> = {}): AchievementsFacts => ({
  os: 'windows',
  settingOn: true,
  host: 'millennium',
  steamRunning: true,
  pluginConnected: false,
  millennium: {
    v3: false,
    pluginInstalled: false,
    pluginEnabled: false,
    activationPending: false,
  },
  support: { supported: true, reason: null },
  decky: null,
  ...overrides,
});

describe('computeAchievementsBadge', () => {
  const v3 = {
    v3: true,
    pluginInstalled: true,
    pluginEnabled: true,
    activationPending: false,
  };

  it.each([
    ['setting off', facts({ settingOn: false, pluginConnected: true }), 'setting-off'],
    [
      'Millennium plugin connected',
      facts({ millennium: v3, pluginConnected: true }),
      'millennium',
    ],
    [
      'plugin ready, Steam off',
      facts({ millennium: v3, steamRunning: false }),
      'millennium',
    ],
    ['plugin waits for a Steam restart', facts({ millennium: v3 }), 'after-restart'],
    [
      'Millennium present, plugin not yet enabled',
      facts({ millennium: { ...v3, pluginEnabled: false }, steamRunning: false }),
      'after-restart',
    ],
    [
      'activation queued',
      facts({ millennium: { ...v3, v3: false, activationPending: true } }),
      'after-restart',
    ],
    ['Millennium can be installed', facts(), 'needs-millennium'],
    [
      'unsupported',
      facts({ host: 'none', support: { supported: false, reason: 'flatpak-steam' } }),
      'unsupported',
    ],
    [
      'Decky plugin connected',
      facts({
        host: 'decky',
        pluginConnected: true,
        decky: { installed: true, pluginInstalled: true, pluginDisabled: false },
      }),
      'decky',
    ],
    [
      'Decky plugin missing',
      facts({
        host: 'decky',
        decky: { installed: true, pluginInstalled: false, pluginDisabled: false },
      }),
      'needs-decky-plugin',
    ],
    [
      'Decky plugin disabled',
      facts({
        host: 'decky',
        decky: { installed: true, pluginInstalled: true, pluginDisabled: true },
      }),
      'needs-decky-plugin',
    ],
    ['Deck without Decky', facts({ host: 'decky', decky: null }), 'needs-decky'],
  ] as const)('%s → %s', (_label, input, state) => {
    expect(computeAchievementsBadge(input).state).toBe(state);
  });

  it('asks for Millennium before LBK ships a release, except on macOS', () => {
    const noRelease = { supported: false, reason: 'no-release' } as const;
    expect(computeAchievementsBadge(facts({ host: 'none', support: noRelease }))).toEqual(
      { state: 'needs-millennium', unsupportedReason: 'no-release' }
    );
    expect(
      computeAchievementsBadge(facts({ os: 'linux', host: 'none', support: noRelease }))
        .state
    ).toBe('needs-millennium');
    expect(
      computeAchievementsBadge(facts({ os: 'macos', host: 'none', support: noRelease }))
        .state
    ).toBe('unsupported');
  });

  it('carries the unsupported reason for the tooltip', () => {
    const badge = computeAchievementsBadge(
      facts({ host: 'none', support: { supported: false, reason: 'macos-too-old' } })
    );
    expect(badge).toEqual({ state: 'unsupported', unsupportedReason: 'macos-too-old' });
  });
});

describe('deliveryFromBadge', () => {
  const badge = (state: Parameters<typeof deliveryFromBadge>[0]['state']) => ({
    state,
    unsupportedReason: null,
  });

  it('maps every badge state onto a delivery', () => {
    expect(deliveryFromBadge(badge('setting-off'), true)).toBe('disabled');
    expect(deliveryFromBadge(badge('millennium'), true)).toBe('plugin-live');
    expect(deliveryFromBadge(badge('millennium'), false)).toBe('plugin-next-start');
    expect(deliveryFromBadge(badge('decky'), false)).toBe('plugin-next-start');
    expect(deliveryFromBadge(badge('after-restart'), false)).toBe('plugin-next-start');
    expect(deliveryFromBadge(badge('needs-millennium'), false)).toBe('needs-millennium');
    expect(deliveryFromBadge(badge('needs-decky-plugin'), false)).toBe(
      'needs-decky-plugin'
    );
    expect(deliveryFromBadge(badge('needs-decky'), false)).toBe('needs-decky');
    expect(deliveryFromBadge(badge('unsupported'), false)).toBe('unavailable');
  });
});

describe('steamTypeFromPath', () => {
  const home = '/home/u';

  it('follows the Steam LBK found, not a leftover Flatpak data dir', () => {
    expect(steamTypeFromPath('/home/u/.local/share/Steam', home)).toBe('native');
    expect(steamTypeFromPath('/home/u/.steam/steam', home)).toBe('native');
    expect(
      steamTypeFromPath('/home/u/.var/app/com.valvesoftware.Steam/data/Steam', home)
    ).toBe('flatpak');
    expect(steamTypeFromPath('/home/u/snap/steam/common/.local/share/Steam', home)).toBe(
      'snap'
    );
  });
});
