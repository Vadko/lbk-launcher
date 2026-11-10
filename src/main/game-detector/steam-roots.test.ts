import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bottleSteamRoots, readSteamLibraryFolders } from './steam-roots';

const mocks = vi.hoisted(() => ({ prefixes: [] as { prefix: string }[] }));

vi.mock('@/main/wine/prefixes', () => ({ listWinePrefixes: () => mocks.prefixes }));

let root: string;
let prefix: string;
let steamPath: string;
let externalLibrary: string;

function makeSteam(dir: string): void {
  for (const sub of ['steamapps', 'appcache', 'config']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
}

function libraryFolders(...paths: string[]): string {
  const entries = paths.map((p, i) => `\t"${i}"\n\t{\n\t\t"path"\t\t"${p}"\n\t}\n`);
  return `"libraryfolders"\n{\n${entries.join('')}}\n`;
}

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-steam-roots-')));
  prefix = path.join(root, 'Bottles', 'Steam');
  steamPath = path.join(prefix, 'drive_c', 'Program Files (x86)', 'Steam');
  externalLibrary = path.join(root, 'Games', 'SteamLibrary');
  makeSteam(steamPath);
  fs.mkdirSync(path.join(externalLibrary, 'steamapps'), { recursive: true });
  fs.mkdirSync(path.join(prefix, 'dosdevices'));
  fs.writeFileSync(path.join(prefix, 'system.reg'), '');
  fs.writeFileSync(
    path.join(prefix, 'user.reg'),
    '[Software\\\\Valve\\\\Steam] 1\n"SteamPath"="c:/program files (x86)/steam"\n'
  );
  fs.symlinkSync('../drive_c', path.join(prefix, 'dosdevices', 'c:'));
  fs.symlinkSync(path.join(root, 'Games'), path.join(prefix, 'dosdevices', 'd:'));
  fs.writeFileSync(
    path.join(steamPath, 'steamapps', 'libraryfolders.vdf'),
    libraryFolders(
      'C:\\\\Program Files (x86)\\\\Steam',
      'D:\\\\SteamLibrary',
      'E:\\\\Unmapped'
    )
  );
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('bottleSteamRoots', () => {
  it('finds the Steam a bottle registered, in its on-disk spelling', () => {
    mocks.prefixes = [{ prefix }];
    expect(bottleSteamRoots()).toEqual([{ steamPath, prefix }]);
  });

  it('skips a bottle without Steam', () => {
    mocks.prefixes = [{ prefix: path.join(root, 'Bottles', 'Empty') }];
    expect(bottleSteamRoots()).toEqual([]);
  });
});

describe('readSteamLibraryFolders', () => {
  it('maps the libraries of a bottle Steam through its drives, once each', () => {
    expect(readSteamLibraryFolders({ steamPath, prefix })).toEqual([
      path.join(steamPath, 'steamapps'),
      path.join(externalLibrary, 'steamapps'),
    ]);
  });
});
