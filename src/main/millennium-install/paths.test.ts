import { describe, expect, it, vi } from 'vitest';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const { millenniumInstallPaths } = await import('./paths');

describe('millenniumInstallPaths', () => {
  it('keeps the Windows record inside <steam>/millennium', () => {
    const p = millenniumInstallPaths({
      os: 'windows',
      home: 'C:\\Users\\u',
      steamPath: 'C:\\Steam',
      env: {},
      insideFlatpak: false,
    });
    expect(p.root).toBe('C:\\Steam\\millennium');
    expect(p.configPath).toBe('C:\\Steam\\millennium\\config\\config.json');
  });

  it('honours XDG dirs natively and ignores them inside Flatpak', () => {
    const env = {
      XDG_DATA_HOME: '/x/data',
      XDG_CONFIG_HOME: '/x/config',
      XDG_STATE_HOME: '/x/state',
    };
    const native = millenniumInstallPaths({
      os: 'linux',
      home: '/home/u',
      steamPath: '/home/u/.local/share/Steam',
      env,
      insideFlatpak: false,
    });
    expect(native.root).toBe('/x/data/millennium');
    expect(native.linux?.envFile).toBe('/x/config/environment.d/lbk-millennium.conf');
    expect(native.purgeDirs).toEqual(['/x/config/millennium', '/x/state/millennium']);
    expect(native.linux?.current).toBe('/home/u/.local/lib/lbk-millennium/current');

    const sandboxed = millenniumInstallPaths({
      os: 'linux',
      home: '/home/u',
      steamPath: '/home/u/.local/share/Steam',
      env,
      insideFlatpak: true,
    });
    expect(sandboxed.root).toBe('/home/u/.local/share/millennium');
    expect(sandboxed.linux?.envFile).toBe(
      '/home/u/.config/environment.d/lbk-millennium.conf'
    );
  });

  it('puts the macOS wrapper into the user Applications folder', () => {
    const p = millenniumInstallPaths({
      os: 'macos',
      home: '/Users/u',
      steamPath: '/Users/u/Library/Application Support/Steam',
      env: {},
      insideFlatpak: false,
    });
    expect(p.macos?.appBundle).toBe('/Users/u/Applications/Steam Millennium.app');
    expect(p.macos?.current).toBe(
      '/Users/u/Library/Application Support/Millennium/runtime/current'
    );
    expect(p.root).toBe('/Users/u/Library/Application Support/Millennium');
  });
});
