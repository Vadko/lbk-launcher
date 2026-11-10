import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hostToWinePath, isWinePrefix, winePrefixOf, wineToHostPath } from './dos-path';

let root: string;
let prefix: string;
let external: string;

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-dos-path-')));
  prefix = path.join(root, 'Bottles', 'Steam Bottle');
  external = path.join(root, 'External');
  fs.mkdirSync(path.join(prefix, 'drive_c', 'Program Files (x86)', 'Steam'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(prefix, 'dosdevices'));
  fs.mkdirSync(path.join(external, 'SteamLibrary'), { recursive: true });
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
  fs.symlinkSync('../drive_c', path.join(prefix, 'dosdevices', 'c:'));
  fs.symlinkSync(external, path.join(prefix, 'dosdevices', 'd:'));
  fs.symlinkSync('/', path.join(prefix, 'dosdevices', 'z:'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('wineToHostPath', () => {
  it.each([
    [
      'a path on C:',
      'C:\\Program Files (x86)\\Steam',
      'drive_c/Program Files (x86)/Steam',
    ],
    [
      'a lowercased path Steam writes',
      'c:/program files (x86)/steam',
      'drive_c/Program Files (x86)/Steam',
    ],
    ['a drive root', 'C:\\', 'drive_c'],
  ])('%s', (_label, winPath, relative) => {
    expect(wineToHostPath(prefix, winPath)).toBe(path.join(prefix, relative));
  });

  it('follows a drive linked outside the prefix', () => {
    expect(wineToHostPath(prefix, 'D:\\SteamLibrary')).toBe(
      path.join(external, 'SteamLibrary')
    );
  });

  it.each([
    ['an unmapped drive', 'E:\\Games'],
    ['a relative path', 'Games\\Steam'],
  ])('%s gives null', (_label, winPath) => {
    expect(wineToHostPath(prefix, winPath)).toBeNull();
  });
});

describe('hostToWinePath', () => {
  it('takes the drive that maps the most of the path', () => {
    expect(
      hostToWinePath(prefix, path.join(prefix, 'drive_c', 'Program Files (x86)', 'Steam'))
    ).toBe('C:\\Program Files (x86)\\Steam');
  });

  it('maps a folder outside the prefix through its own drive', () => {
    expect(hostToWinePath(prefix, path.join(external, 'SteamLibrary'))).toBe(
      'D:\\SteamLibrary'
    );
  });

  it('falls back to Z: for the rest of the host', () => {
    expect(hostToWinePath(prefix, '/usr/bin')).toBe('Z:\\usr\\bin');
  });
});

describe('winePrefixOf', () => {
  it.each([
    ['a game folder', () => path.join(prefix, 'drive_c', 'Program Files (x86)', 'Steam')],
    ['drive_c itself', () => path.join(prefix, 'drive_c')],
  ])('finds the prefix of %s', (_label, hostPath) => {
    expect(winePrefixOf(hostPath())).toBe(prefix);
  });

  it.each([
    ['a folder outside every prefix', () => external],
    ['the prefix folder itself', () => prefix],
  ])('gives null for %s', (_label, hostPath) => {
    expect(winePrefixOf(hostPath())).toBeNull();
  });

  it('tells a prefix from a plain folder', () => {
    expect([isWinePrefix(prefix), isWinePrefix(external)]).toEqual([true, false]);
  });
});
