import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetchSteamLibraryFromApi } from '../steam-library-api';
import {
  getCurrentSteamAccountId,
  getSteamLibraryAppIds,
  invalidateSteamLibraryAppIdsCache,
} from './steam';

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
vi.mock('../wine/bottle-steam-roots', () => ({
  bottleInstalledSteamGames: () => [],
  invalidateBottleSteamCaches: () => undefined,
}));
vi.mock('../utils/registry', () => ({ getRegistryString: vi.fn() }));
vi.mock('../utils/steam-bridge', () => ({ getSteamBridge: () => Promise.resolve(null) }));
vi.mock('../steam-library-api', () => ({
  fetchSteamLibraryFromApi: vi.fn(() => Promise.resolve({ appIds: [620], remaining: 9 })),
  invalidateSteamLibraryCache: vi.fn(),
  readSteamLibraryCache: () => null,
  writeSteamLibraryCache: vi.fn(),
}));

const VALID_STEAM3 = '126948360';
const VALID_STEAM64 = '76561198087214088';
const BASE_STEAM64 = '76561197960265728';

let steamRoot = '';

function addUserdata(...ids: string[]): void {
  for (const id of ids) {
    fs.mkdirSync(path.join(steamRoot, 'userdata', id, 'config'), { recursive: true });
  }
}

function writeLoginUsers(mostRecentSteam64: string): void {
  fs.writeFileSync(
    path.join(steamRoot, 'config', 'loginusers.vdf'),
    `"users"\n{\n\t"${mostRecentSteam64}"\n\t{\n\t\t"AccountName"\t\t"player"\n\t\t"MostRecent"\t\t"1"\n\t\t"Timestamp"\t\t"1700000000"\n\t}\n}\n`
  );
}

beforeAll(() => {
  state.home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-steam-user-'));
  steamRoot = path.join(state.home, '.steam', 'steam');
  for (const dir of ['appcache', 'config', 'steamapps']) {
    fs.mkdirSync(path.join(steamRoot, dir), { recursive: true });
  }
});

afterEach(() => {
  fs.rmSync(path.join(steamRoot, 'userdata'), { recursive: true, force: true });
  fs.rmSync(path.join(steamRoot, 'config', 'loginusers.vdf'), { force: true });
  invalidateSteamLibraryAppIdsCache();
  vi.mocked(fetchSteamLibraryFromApi).mockClear();
});

afterAll(() => {
  fs.rmSync(state.home, { recursive: true, force: true });
});

describe('Steam account selection', () => {
  it.each([
    ['userdata/0 beside a real account', () => addUserdata('0', VALID_STEAM3)],
    [
      'loginusers.vdf naming the base SteamID64',
      () => {
        addUserdata('0', VALID_STEAM3);
        writeLoginUsers(BASE_STEAM64);
      },
    ],
    [
      'loginusers.vdf naming the real account',
      () => {
        addUserdata('0', VALID_STEAM3);
        writeLoginUsers(VALID_STEAM64);
      },
    ],
  ])('picks the real account for %s', async (_, arrange) => {
    arrange();

    expect(getCurrentSteamAccountId()).toBe(VALID_STEAM3);
    await expect(getSteamLibraryAppIds()).resolves.toEqual([620]);
    expect(fetchSteamLibraryFromApi).toHaveBeenCalledExactlyOnceWith(VALID_STEAM64);
  });

  it.each([
    ['only userdata/0', () => addUserdata('0')],
    [
      'only userdata/0 and loginusers.vdf naming the base SteamID64',
      () => {
        addUserdata('0');
        writeLoginUsers(BASE_STEAM64);
      },
    ],
  ])('finds no account and asks no API for %s', async (_, arrange) => {
    arrange();

    expect(getCurrentSteamAccountId()).toBeNull();
    await expect(getSteamLibraryAppIds()).resolves.toEqual([]);
    expect(fetchSteamLibraryFromApi).not.toHaveBeenCalled();
  });
});
