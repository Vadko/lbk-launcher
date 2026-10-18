import type * as NodeFs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const existing = new Set<string>();
const links = new Map<string, string>();
const fakePlatform = { value: 'macos' as 'macos' | 'windows' | 'linux' };
const fakeSteamPath = { value: null as string | null };

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  return {
    ...actual,
    existsSync: (p: string) => existing.has(p),
    readlinkSync: (p: string) => {
      const target = links.get(p);
      if (target === undefined) {
        throw Object.assign(new Error('EINVAL'), { code: 'EINVAL' });
      }
      return target;
    },
  };
});
vi.mock('@/main/game-detector/steam', () => ({
  getSteamPath: () => fakeSteamPath.value,
}));
vi.mock('@/main/utils/platform', () => ({ getPlatform: () => fakePlatform.value }));

const {
  classifyMillenniumMarkers,
  detectMillennium,
  planEnabledPluginsEdit,
  renderInitialMillenniumConfig,
  resetMillenniumDetectCache,
  resolveMillenniumPaths,
} = await import('@/main/utils/millennium');

describe('classifyMillenniumMarkers', () => {
  it.each([
    ['windows', 'a stray wsock32.dll', ['wsock32.dll'], null, null],
    ['windows', 'the v3 library alone', ['millennium/lib/millennium.dll'], null, null],
    [
      'windows',
      'the v3 library and its loader',
      ['millennium/lib/millennium.dll', 'wsock32.dll'],
      null,
      'v3',
    ],
    ['windows', 'one v2 file', ['millennium.dll'], null, null],
    ['windows', 'both v2 files', ['millennium.dll', 'user32.dll.local'], null, 'v2'],
    [
      'linux',
      'the runtime without the libXtst link',
      ['/usr/lib/millennium/libmillennium_x86.so'],
      null,
      null,
    ],
    [
      'linux',
      'a libXtst link into Millennium',
      [],
      '/usr/lib/millennium/libmillennium_bootstrap_x86.so',
      'v3',
    ],
    ['linux', "Valve's own libXtst link", [], '../ubuntu12_32/libXtst.so.6.real', null],
    ['macos', 'the system wrapper', ['/Applications/Steam Millennium.app'], null, 'v3'],
    ['macos', 'the user wrapper', ['~/Applications/Steam Millennium.app'], null, 'v3'],
    [
      'macos',
      'the runtime',
      ['~/Library/Application Support/Millennium/runtime'],
      null,
      'v3',
    ],
    [
      'macos',
      'the tier0 hook',
      ['Steam.AppBundle/Steam/Contents/MacOS/libtier0_s.real.dylib'],
      null,
      'v3',
    ],
  ] as const)('%s: %s', (platform, _label, markers, xtstTarget, generation) => {
    const result = classifyMillenniumMarkers(platform, new Set(markers), xtstTarget);
    expect(result.generation).toBe(generation);
    expect(result.evidence).toEqual(expect.arrayContaining([...markers]));
  });
});

describe('resolveMillenniumPaths', () => {
  const home = '/home/deck';
  const resolve = (
    platform: 'windows' | 'linux' | 'macos',
    env: Record<string, string> = {},
    insideFlatpak = false
  ) =>
    resolveMillenniumPaths({
      os: platform,
      steamPath: platform === 'windows' ? 'C:\\Program Files (x86)\\Steam' : '/s',
      home: platform === 'macos' ? '/Users/a' : home,
      env,
      insideFlatpak,
    });

  it('uses the Steam folder on Windows and Application Support on macOS', () => {
    expect(resolve('windows')).toEqual({
      pluginsDirs: ['C:\\Program Files (x86)\\Steam\\millennium\\plugins'],
      configPaths: ['C:\\Program Files (x86)\\Steam\\millennium\\config\\config.json'],
    });
    expect(resolve('macos')).toEqual({
      pluginsDirs: ['/Users/a/Library/Application Support/Millennium/plugins'],
      configPaths: ['/Users/a/Library/Application Support/Millennium/config.json'],
    });
  });

  it('honours XDG variables outside Flatpak, with the defaults as the next candidate', () => {
    const r = resolve('linux', { XDG_DATA_HOME: '/data', XDG_CONFIG_HOME: '/cfg' });
    expect(r.pluginsDirs.slice(0, 2)).toEqual([
      '/data/millennium/plugins',
      '/home/deck/.local/share/millennium/plugins',
    ]);
    expect(r.configPaths[0]).toBe('/cfg/millennium/config.json');
  });

  it('falls back to XDG defaults and ends with the Flatpak Steam location', () => {
    const r = resolve('linux');
    expect(r.pluginsDirs[0]).toBe('/home/deck/.local/share/millennium/plugins');
    expect(r.configPaths[0]).toBe('/home/deck/.config/millennium/config.json');
    expect(r.pluginsDirs.at(-1)).toBe(
      '/home/deck/.var/app/com.valvesoftware.Steam/data/millennium/plugins'
    );
    expect(r.configPaths.at(-1)).toBe(
      '/home/deck/.var/app/com.valvesoftware.Steam/config/millennium/config.json'
    );
    expect(r.pluginsDirs).toHaveLength(r.configPaths.length);
  });

  it('ignores sandboxed XDG variables inside Flatpak', () => {
    const r = resolve(
      'linux',
      {
        XDG_DATA_HOME: '/home/deck/.var/app/ua.lbk.Launcher/data',
        XDG_CONFIG_HOME: '/home/deck/.var/app/ua.lbk.Launcher/config',
      },
      true
    );
    expect(r.pluginsDirs[0]).toBe('/home/deck/.local/share/millennium/plugins');
    expect(r.pluginsDirs.some((p) => p.includes('ua.lbk.Launcher'))).toBe(false);
  });
});

describe('planEnabledPluginsEdit', () => {
  const config = (enabled: unknown) =>
    JSON.stringify({
      general: { theme: 'x' },
      plugins: { enabledPlugins: enabled, other: 1 },
    });

  it('adds the plugin and keeps other keys', () => {
    const r = planEnabledPluginsEdit(config(['core']), 'lbk-bridge', true);
    expect(r.kind).toBe('changed');
    if (r.kind === 'changed') {
      const next = JSON.parse(r.next);
      expect(next.plugins.enabledPlugins).toEqual(['core', 'lbk-bridge']);
      expect(next.plugins.other).toBe(1);
      expect(next.general).toEqual({ theme: 'x' });
    }
  });

  it('creates enabledPlugins inside an existing plugins object', () => {
    const r = planEnabledPluginsEdit(JSON.stringify({ plugins: {} }), 'lbk-bridge', true);
    expect(r.kind === 'changed' && JSON.parse(r.next).plugins.enabledPlugins).toEqual([
      'lbk-bridge',
    ]);
  });

  it('is idempotent', () => {
    expect(planEnabledPluginsEdit(config(['lbk-bridge']), 'lbk-bridge', true).kind).toBe(
      'unchanged'
    );
    expect(planEnabledPluginsEdit(config(['core']), 'lbk-bridge', false).kind).toBe(
      'unchanged'
    );
  });

  it('removes the plugin', () => {
    const r = planEnabledPluginsEdit(config(['lbk-bridge', 'core']), 'lbk-bridge', false);
    expect(r.kind === 'changed' && JSON.parse(r.next).plugins.enabledPlugins).toEqual([
      'core',
    ]);
  });

  it('creates plugins in a fresh config that has none yet', () => {
    const fresh = JSON.stringify({ general: { injectCSS: true } });
    const r = planEnabledPluginsEdit(fresh, 'lbk-bridge', true);
    expect(r.kind).toBe('changed');
    if (r.kind === 'changed') {
      expect(JSON.parse(r.next)).toEqual({
        general: { injectCSS: true },
        plugins: { enabledPlugins: ['lbk-bridge'] },
      });
    }
    expect(planEnabledPluginsEdit(fresh, 'lbk-bridge', false).kind).toBe('unchanged');
  });

  it.each([
    ['broken JSON', '{"plugins": '],
    ['a top-level array', '[]'],
    ['plugins that is not an object', '{"plugins": []}'],
    ['a non-array enabledPlugins', config('lbk-bridge')],
  ])('rejects %s', (_label, raw) => {
    expect(planEnabledPluginsEdit(raw, 'lbk-bridge', true).kind).toBe('invalid');
  });
});

describe('detectMillennium', () => {
  const home = os.homedir();

  beforeEach(() => {
    existing.clear();
    links.clear();
    fakeSteamPath.value = null;
    resetMillenniumDetectCache();
  });

  it.each([
    ['/Applications/Steam Millennium.app'],
    [path.join(home, 'Applications/Steam Millennium.app')],
    [path.join(home, 'Library/Application Support/Millennium/runtime')],
  ])('reports macOS marker %s as v3 without blocking TCP CDP', (marker) => {
    fakePlatform.value = 'macos';
    existing.add(marker);
    // resolveMillenniumPaths() joins macOS paths with path.posix, also on a Windows host.
    existing.add(path.posix.join(home, 'Library/Application Support/Millennium'));

    const info = detectMillennium();
    expect(info.generation).toBe('v3');
    expect(info.blocksTcpCdp).toBe(false);
    expect(info.pluginsDir).toBe(
      path.posix.join(home, 'Library/Application Support/Millennium/plugins')
    );
    expect(info.configPath).toBe(
      path.posix.join(home, 'Library/Application Support/Millennium/config.json')
    );
  });

  it('detects the macOS tier0 install inside the Steam bundle', () => {
    fakePlatform.value = 'macos';
    fakeSteamPath.value = '/Users/a/Library/Application Support/Steam';
    existing.add(
      path.join(
        fakeSteamPath.value,
        'Steam.AppBundle/Steam/Contents/MacOS/libtier0_s.real.dylib'
      )
    );
    const info = detectMillennium();
    expect(info.generation).toBe('v3');
    expect(info.pluginsDir).toBeNull();
  });

  it('reports Linux v3 as blocking TCP CDP', () => {
    fakePlatform.value = 'linux';
    fakeSteamPath.value = '/home/deck/.local/share/Steam';
    links.set(
      path.join(fakeSteamPath.value, 'ubuntu12_32/libXtst.so.6'),
      '/usr/lib/millennium/libmillennium_bootstrap_x86.so'
    );
    const info = detectMillennium();
    expect(info.generation).toBe('v3');
    expect(info.blocksTcpCdp).toBe(true);
  });

  it('reports nothing for vanilla Steam', () => {
    fakePlatform.value = 'macos';
    fakeSteamPath.value = '/Users/a/Library/Application Support/Steam';
    const info = detectMillennium();
    expect(info).toMatchObject({
      installed: false,
      generation: null,
      blocksTcpCdp: false,
    });
  });
});

describe('renderInitialMillenniumConfig', () => {
  it.each([
    ['managed', true],
    ['unmanaged', false],
  ])(
    'already has the plugin enabled when %s, so the first plugin setup changes nothing',
    (_case, managed) => {
      const raw = renderInitialMillenniumConfig('lbk-bridge', managed);
      expect(planEnabledPluginsEdit(raw, 'lbk-bridge', true)).toEqual({
        kind: 'unchanged',
      });
    }
  );

  it('turns off Millennium update checks only where LBK manages updates', () => {
    expect(JSON.parse(renderInitialMillenniumConfig('lbk-bridge', true))).toEqual({
      plugins: { enabledPlugins: ['lbk-bridge'] },
      general: { checkForMillenniumUpdates: false },
    });
    expect(JSON.parse(renderInitialMillenniumConfig('lbk-bridge', false))).toEqual({
      plugins: { enabledPlugins: ['lbk-bridge'] },
    });
  });
});
