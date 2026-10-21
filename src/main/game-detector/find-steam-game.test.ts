import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { findSteamGame } from './steam';

const state = vi.hoisted(() => ({ home: '' }));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof os>();
  return { ...actual, homedir: () => state.home };
});

vi.mock('../utils/platform', () => ({
  forCurrentOS: (table: { linux: unknown }) => table.linux,
  getPlatform: () => 'linux',
  isWindows: () => false,
}));

vi.mock('registry-js', () => ({ HKEY: {} }));
vi.mock('../utils/registry', () => ({ getRegistryString: vi.fn() }));
vi.mock('../utils/steam-bridge', () => ({ getSteamBridge: vi.fn() }));
vi.mock('../steam-library-api', () => ({
  fetchSteamLibraryFromApi: vi.fn(),
  invalidateSteamLibraryCache: vi.fn(),
  readSteamLibraryCache: vi.fn(),
  steam3ToSteam64: vi.fn(),
  writeSteamLibraryCache: vi.fn(),
}));

const APP_ID = 387990;
const MISSING_APP_ID = 999999;
const INSTALLDIR = 'OxygenNotIncluded';

let steamapps = '';

beforeAll(() => {
  state.home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-steam-'));
  const steamRoot = path.join(state.home, '.steam', 'steam');
  steamapps = path.join(steamRoot, 'steamapps');
  for (const dir of ['appcache', 'config', `steamapps/common/${INSTALLDIR}`]) {
    fs.mkdirSync(path.join(steamRoot, dir), { recursive: true });
  }
  fs.writeFileSync(
    path.join(steamapps, `appmanifest_${APP_ID}.acf`),
    `"AppState"\n{\n\t"appid"\t\t"${APP_ID}"\n\t"installdir"\t\t"${INSTALLDIR}"\n\t"StateFlags"\t\t"4"\n\t"LastUpdated"\t\t"0"\n}\n`
  );
});

afterAll(() => {
  fs.rmSync(state.home, { recursive: true, force: true });
});

describe('findSteamGame', () => {
  it.each([
    ['empty name', ''],
    ['null name', null],
  ])('resolves an entry with %s by app id', (_, folder) => {
    expect(findSteamGame(folder, APP_ID)).toBe(
      path.join(steamapps, 'common', INSTALLDIR)
    );
  });

  it('resolves a named folder without an app id', () => {
    expect(findSteamGame(INSTALLDIR)).toBe(path.join(steamapps, 'common', INSTALLDIR));
  });

  it.each([
    ['empty name', ''],
    ['null name', null],
    ['steamapps/common/', 'steamapps/common/'],
    ['common/', 'common/'],
    ['common\\', 'common\\'],
    ['.', '.'],
    ['..', '..'],
  ])('never returns a library directory for %s', (_, folder) => {
    expect(findSteamGame(folder, MISSING_APP_ID)).toBeNull();
  });
});
