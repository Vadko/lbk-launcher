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
  withPluginHostOverride,
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
  it.each([
    ['Decky where it is installed', linuxDesktop({ deckyInstalled: true }), 'decky'],
    [
      'Decky over an installed Millennium',
      { ...linuxDesktop({ deckyInstalled: true }), millenniumGeneration: 'v3' },
      'decky',
    ],
    ['Decky on SteamOS without Decky', linuxDesktop({ steamOS: true }), 'decky'],
    ['a supported Millennium', linuxDesktop(), 'millennium'],
    [
      'an installed Millennium the checks would refuse',
      { ...linuxDesktop({ steamType: 'flatpak' }), millenniumGeneration: 'v3' },
      'millennium',
    ],
    ['nothing for Flatpak Steam', linuxDesktop({ steamType: 'flatpak' }), 'none'],
    ['nothing for an old macOS', mac([21, 0]), 'none'],
  ] as const)('picks %s', (_label, facts, host) => {
    expect(pickPluginHost(facts, evaluateMillenniumSupport(facts))).toBe(host);
  });
});

describe('withPluginHostOverride', () => {
  const deck = linuxDesktop({ steamOS: true });
  const host = (f: HostFacts) => pickPluginHost(f, evaluateMillenniumSupport(f));

  it('lets a dev build pick Millennium on a Deck and keeps every other check', () => {
    expect(host(deck)).toBe('decky');
    expect(evaluateMillenniumSupport(deck).reason).toBe('steamos');

    const overridden = withPluginHostOverride(deck, 'millennium');
    expect(host(overridden)).toBe('millennium');
    expect(evaluateMillenniumSupport(overridden).reason).toBeNull();
    const rt64Deck = linuxDesktop({ steamOS: true, rt64: true });
    expect(
      evaluateMillenniumSupport(withPluginHostOverride(rt64Deck, 'millennium')).reason
    ).toBe('steam-rt64');
  });

  it('still yields to an installed Decky and ignores other values', () => {
    const withDecky = linuxDesktop({ steamOS: true, deckyInstalled: true });
    expect(host(withPluginHostOverride(withDecky, 'millennium'))).toBe('decky');
    expect(withPluginHostOverride(deck, undefined)).toBe(deck);
    expect(withPluginHostOverride(deck, 'decky')).toBe(deck);
  });
});

describe('deckyLoaderOffer', () => {
  const offer = (overrides: Partial<Parameters<typeof deckyLoaderOffer>[0]> = {}) =>
    deckyLoaderOffer({
      host: 'decky',
      deckyInstalled: false,
      deckyRunning: false,
      gamescope: false,
      installing: false,
      ...overrides,
    });

  it('offers the installer only where Decky is the host and missing', () => {
    expect(offer()).toEqual({ installing: false, blockedBy: null, repair: false });
    expect(offer({ host: 'millennium' })).toBeNull();
    expect(offer({ host: 'none' })).toBeNull();
    expect(offer({ deckyInstalled: true, deckyRunning: true })).toBeNull();
  });

  it('keeps offering a repair when the installed loader does not run', () => {
    expect(offer({ deckyInstalled: true })).toEqual({
      installing: false,
      blockedBy: null,
      repair: true,
    });
  });

  it('blocks the zenity-driven installer in Game Mode', () => {
    expect(offer({ gamescope: true })).toEqual({
      installing: false,
      blockedBy: 'game-mode',
      repair: false,
    });
  });

  it('keeps reporting a running install after PluginLoader appears mid-run', () => {
    expect(offer({ deckyInstalled: true, deckyRunning: true, installing: true })).toEqual(
      {
        installing: true,
        blockedBy: null,
        repair: false,
      }
    );
  });
});

const facts = (overrides: Partial<AchievementsFacts> = {}): AchievementsFacts => ({
  os: 'windows',
  settingOn: true,
  host: 'millennium',
  steamRunning: true,
  connectedHost: null,
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
  const decky = (
    overrides: Partial<NonNullable<AchievementsFacts['decky']>> = {}
  ): AchievementsFacts['decky'] => ({
    installed: true,
    running: true,
    pluginInstalled: true,
    pluginDisabled: false,
    ...overrides,
  });
  const v3 = {
    v3: true,
    pluginInstalled: true,
    pluginEnabled: true,
    activationPending: false,
  };

  it.each([
    [
      'setting off',
      facts({ settingOn: false, connectedHost: 'millennium' }),
      'setting-off',
    ],
    [
      'Millennium plugin connected',
      facts({ millennium: v3, connectedHost: 'millennium' }),
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
      facts({ host: 'decky', connectedHost: 'decky', decky: decky() }),
      'decky',
    ],
    [
      'Decky plugin missing',
      facts({ host: 'decky', decky: decky({ pluginInstalled: false }) }),
      'needs-decky-plugin',
    ],
    [
      'Decky plugin disabled',
      facts({ host: 'decky', decky: decky({ pluginDisabled: true }) }),
      'needs-decky-plugin',
    ],
    ['Deck without Decky', facts({ host: 'decky', decky: null }), 'needs-decky'],
    [
      'Linux PC with Decky whose delivery runs through Millennium',
      facts({
        host: 'decky',
        connectedHost: 'millennium',
        decky: decky({ running: false, pluginInstalled: false }),
      }),
      'millennium',
    ],
    [
      'Decky installed but its loader is down',
      facts({ host: 'decky', decky: decky({ running: false }) }),
      'needs-decky',
    ],
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
  it.each([
    ['setting-off', true, 'disabled'],
    ['millennium', true, 'plugin-live'],
    ['millennium', false, 'plugin-next-start'],
    ['decky', false, 'plugin-next-start'],
    ['after-restart', false, 'plugin-next-start'],
    ['needs-millennium', false, 'needs-millennium'],
    ['needs-decky-plugin', false, 'needs-decky-plugin'],
    ['needs-decky', false, 'needs-decky'],
    ['unsupported', false, 'unavailable'],
  ] as const)('maps %s (live %s) to %s', (state, live, delivery) => {
    expect(deliveryFromBadge({ state, unsupportedReason: null }, live)).toBe(delivery);
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
