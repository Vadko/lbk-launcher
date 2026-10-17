import type * as NodeFs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  resolveMillenniumPaths,
} = await import('@/main/utils/millennium');

describe('classifyMillenniumMarkers', () => {
  it('ignores a stray wsock32.dll on Windows', () => {
    const r = classifyMillenniumMarkers('windows', new Set(['wsock32.dll']), null);
    expect(r.generation).toBeNull();
    expect(r.evidence).toEqual(['wsock32.dll']);
  });

  it('needs both the v3 library and its loader on Windows', () => {
    expect(
      classifyMillenniumMarkers(
        'windows',
        new Set(['millennium/lib/millennium.dll']),
        null
      ).generation
    ).toBeNull();
    expect(
      classifyMillenniumMarkers(
        'windows',
        new Set(['millennium/lib/millennium.dll', 'wsock32.dll']),
        null
      ).generation
    ).toBe('v3');
  });

  it('needs both v2 files on Windows', () => {
    expect(
      classifyMillenniumMarkers('windows', new Set(['millennium.dll']), null).generation
    ).toBeNull();
    expect(
      classifyMillenniumMarkers(
        'windows',
        new Set(['millennium.dll', 'user32.dll.local']),
        null
      ).generation
    ).toBe('v2');
  });

  it('decides Linux by the libXtst symlink, not by the runtime alone', () => {
    const runtimeOnly = classifyMillenniumMarkers(
      'linux',
      new Set(['/usr/lib/millennium/libmillennium_x86.so']),
      null
    );
    expect(runtimeOnly.generation).toBeNull();
    expect(runtimeOnly.evidence).toContain('/usr/lib/millennium/libmillennium_x86.so');

    expect(
      classifyMillenniumMarkers(
        'linux',
        new Set(),
        '/usr/lib/millennium/libmillennium_bootstrap_x86.so'
      ).generation
    ).toBe('v3');
    expect(
      classifyMillenniumMarkers('linux', new Set(), '../ubuntu12_32/libXtst.so.6.real')
        .generation
    ).toBeNull();
  });

  it.each([
    '/Applications/Steam Millennium.app',
    '~/Applications/Steam Millennium.app',
    '~/Library/Application Support/Millennium/runtime',
    'Steam.AppBundle/Steam/Contents/MacOS/libtier0_s.real.dylib',
  ])('treats macOS marker %s as v3', (marker) => {
    expect(classifyMillenniumMarkers('macos', new Set([marker]), null).generation).toBe(
      'v3'
    );
  });
});

describe('resolveMillenniumPaths', () => {
  const home = '/home/deck';

  it('uses the Steam folder on Windows', () => {
    const r = resolveMillenniumPaths({
      os: 'windows',
      steamPath: 'C:\\Program Files (x86)\\Steam',
      home: 'C:\\Users\\a',
      env: {},
      insideFlatpak: false,
    });
    expect(r.pluginsDirs).toEqual([
      'C:\\Program Files (x86)\\Steam\\millennium\\plugins',
    ]);
    expect(r.configPaths).toEqual([
      'C:\\Program Files (x86)\\Steam\\millennium\\config\\config.json',
    ]);
  });

  it('uses Application Support on macOS', () => {
    const r = resolveMillenniumPaths({
      os: 'macos',
      steamPath: '/x',
      home: '/Users/a',
      env: {},
      insideFlatpak: false,
    });
    expect(r.pluginsDirs).toEqual([
      '/Users/a/Library/Application Support/Millennium/plugins',
    ]);
    expect(r.configPaths).toEqual([
      '/Users/a/Library/Application Support/Millennium/config.json',
    ]);
  });

  it('honours XDG variables outside Flatpak', () => {
    const r = resolveMillenniumPaths({
      os: 'linux',
      steamPath: '/s',
      home,
      env: { XDG_DATA_HOME: '/data', XDG_CONFIG_HOME: '/cfg' },
      insideFlatpak: false,
    });
    expect(r.pluginsDirs[0]).toBe('/data/millennium/plugins');
    expect(r.configPaths[0]).toBe('/cfg/millennium/config.json');
    expect(r.pluginsDirs[1]).toBe('/home/deck/.local/share/millennium/plugins');
  });

  it('falls back to XDG defaults when unset', () => {
    const r = resolveMillenniumPaths({
      os: 'linux',
      steamPath: '/s',
      home,
      env: {},
      insideFlatpak: false,
    });
    expect(r.pluginsDirs[0]).toBe('/home/deck/.local/share/millennium/plugins');
    expect(r.configPaths[0]).toBe('/home/deck/.config/millennium/config.json');
  });

  it('ignores sandboxed XDG variables inside Flatpak', () => {
    const r = resolveMillenniumPaths({
      os: 'linux',
      steamPath: '/s',
      home,
      env: {
        XDG_DATA_HOME: '/home/deck/.var/app/ua.lbk.Launcher/data',
        XDG_CONFIG_HOME: '/home/deck/.var/app/ua.lbk.Launcher/config',
      },
      insideFlatpak: true,
    });
    expect(r.pluginsDirs[0]).toBe('/home/deck/.local/share/millennium/plugins');
    expect(r.pluginsDirs.some((p) => p.includes('ua.lbk.Launcher'))).toBe(false);
  });

  it('includes the Flatpak Steam location as the last candidate', () => {
    const r = resolveMillenniumPaths({
      os: 'linux',
      steamPath: '/s',
      home,
      env: {},
      insideFlatpak: false,
    });
    expect(r.pluginsDirs.at(-1)).toBe(
      '/home/deck/.var/app/com.valvesoftware.Steam/data/millennium/plugins'
    );
    expect(r.configPaths.at(-1)).toBe(
      '/home/deck/.var/app/com.valvesoftware.Steam/config/millennium/config.json'
    );
    expect(r.pluginsDirs).toHaveLength(r.configPaths.length);
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

  it('rejects invalid JSON', () => {
    expect(planEnabledPluginsEdit('{"plugins": ', 'lbk-bridge', true).kind).toBe(
      'invalid'
    );
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

  it('rejects a config whose plugins is not an object', () => {
    expect(planEnabledPluginsEdit('[]', 'lbk-bridge', true).kind).toBe('invalid');
    expect(planEnabledPluginsEdit('{"plugins": []}', 'lbk-bridge', true).kind).toBe(
      'invalid'
    );
  });

  it('rejects a non-array enabledPlugins', () => {
    expect(planEnabledPluginsEdit(config('lbk-bridge'), 'lbk-bridge', true).kind).toBe(
      'invalid'
    );
  });
});

describe('detectMillennium', () => {
  const home = os.homedir();
  let clock = Date.parse('2026-10-09T00:00:00Z');

  beforeEach(() => {
    existing.clear();
    links.clear();
    fakeSteamPath.value = null;
    // Step past the 60 s detection cache.
    clock += 120_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(clock);
  });
  afterAll(() => vi.useRealTimers());

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
  it('already has the plugin enabled, so the first plugin setup changes nothing', () => {
    for (const managed of [true, false]) {
      const raw = renderInitialMillenniumConfig('lbk-bridge', managed);
      expect(planEnabledPluginsEdit(raw, 'lbk-bridge', true)).toEqual({
        kind: 'unchanged',
      });
    }
  });

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
