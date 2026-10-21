import type * as FsModule from 'fs';
import * as path from 'path';
import type * as RegistryJs from 'registry-js';
import { HKEY } from 'registry-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistryString } from '../utils/registry';

vi.mock('../utils/platform', () => ({
  isLinux: () => false,
  isMacOS: () => false,
  isWindows: () => true,
}));

const registry = vi.hoisted(() => ({
  // `HIVE\key` -> string values; parent keys exist implicitly, as in the real registry
  keys: new Map<string, Record<string, string>>(),
}));

vi.mock('registry-js', async (importOriginal) => {
  const actual = await importOriginal<typeof RegistryJs>();
  return {
    ...actual,
    enumerateValuesSafe: (hive: HKEY, key: string) => {
      // Each key also holds a binary value, which the native module returns as a hole
      const values = new Array<RegistryJs.RegistryValue>(1);
      for (const [name, data] of Object.entries(
        registry.keys.get(`${hive}\\${key}`) ?? {}
      )) {
        values.push({ name, type: actual.RegistryValueType.REG_SZ, data });
      }
      return values;
    },
    enumerateKeysSafe: (hive: HKEY, key: string) => {
      const prefix = `${hive}\\${key}\\`.toLowerCase();
      const children = [...registry.keys.keys()]
        .filter((path) => path.toLowerCase().startsWith(prefix))
        .map((path) => path.slice(prefix.length).split('\\')[0]);
      return [...new Set(children)];
    },
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  return {
    ...actual,
    existsSync: (file: string) => file.replace(/\\/g, '/').startsWith('/games/'),
    readdirSync: () => [],
  };
});

function setKey(key: string, values: Record<string, string>) {
  registry.keys.set(`${HKEY.HKEY_LOCAL_MACHINE}\\SOFTWARE\\${key}`, values);
}

beforeEach(() => {
  registry.keys.clear();
  vi.resetModules();
});

describe('getRegistryString', () => {
  it('matches value names case-insensitively and returns null when missing', () => {
    setKey('Valve\\Steam', { InstallPath: 'D:\\Ігри\\Steam' });
    const key = 'SOFTWARE\\Valve\\Steam';
    expect(getRegistryString(HKEY.HKEY_LOCAL_MACHINE, key, 'installpath')).toBe(
      'D:\\Ігри\\Steam'
    );
    expect(getRegistryString(HKEY.HKEY_LOCAL_MACHINE, key, 'Missing')).toBeNull();
    expect(getRegistryString(HKEY.HKEY_CURRENT_USER, key, 'InstallPath')).toBeNull();
  });
});

describe('Rockstar', () => {
  it('prefers the 32-bit view and falls back when its folder is missing', async () => {
    setKey('WOW6432Node\\Rockstar Games\\Launcher', { InstallFolder: '/games/Launcher' });
    setKey('WOW6432Node\\Rockstar Games\\Grand Theft Auto V', {
      InstallFolder: '/games/GTAV',
    });
    setKey('WOW6432Node\\Rockstar Games\\Max Payne 3', {
      InstallFolder: '/elsewhere/MP3',
    });
    setKey('Rockstar Games\\Max Payne 3', { InstallFolder: '/games/MaxPayne3' });

    const { getInstalledRockstarGamePaths } = await import('./rockstar');
    expect(getInstalledRockstarGamePaths().sort()).toEqual(['gtav', 'maxpayne3']);
  });
});

describe('Ubisoft Connect', () => {
  it('takes install ids from subkeys', async () => {
    setKey('WOW6432Node\\Ubisoft\\Launcher\\Installs\\635', {
      InstallDir: '/games/Far Cry 3/',
    });
    setKey('WOW6432Node\\Ubisoft\\Launcher\\Installs\\720', {
      InstallDir: '/gone/Old Game',
    });

    const uplay = await import('./uplay');
    expect(uplay.getInstalledUplayGamePaths()).toEqual(['Far Cry 3']);
    expect(uplay.getUplayGameId('/games/Far Cry 3')).toBe('635');
    // uplay.ts rewrites the registry's forward slashes to path.sep.
    expect(uplay.findUplayGame('far cry 3')).toBe(path.normalize('/games/Far Cry 3'));
  });
});

describe('EA app', () => {
  it('walks nested keys and dedupes the same folder', async () => {
    setKey('WOW6432Node\\Electronic Arts\\Battlefield 1', {
      'Install Dir': '/games/Battlefield 1\\',
    });
    setKey('Electronic Arts\\Electronic Arts\\Battlefield 1', {
      'Install Dir': '/games/Battlefield 1',
    });
    setKey('Electronic Arts\\Dead Space', { 'Install Dir': '/games/Dead Space' });
    setKey('Electronic Arts\\EA Desktop', { Version: '13.0' });

    const { getInstalledEAGamePaths } = await import('./ea');
    expect(getInstalledEAGamePaths().sort()).toEqual(['Battlefield 1', 'Dead Space']);
  });
});
