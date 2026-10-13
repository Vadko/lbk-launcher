import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findEpicGame, getInstalledEpicGamePaths } from './epic';
import { findGOGGame, getHeroicGOGId, getInstalledGOGGamePaths } from './gog';

vi.mock('../utils/platform', () => ({
  isLinux: () => true,
  isMacOS: () => false,
  isWindows: () => false,
}));

let home: string;
let originalHome: string | undefined;

const gamesDir = () => path.join(home, 'Games/Heroic');
const heroicConfig = () => path.join(home, '.config/heroic');

function writeJson(relative: string, data: unknown): void {
  const file = path.join(heroicConfig(), relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

function makeGameDirs(...names: string[]): void {
  for (const name of names) {
    fs.mkdirSync(path.join(gamesDir(), name), { recursive: true });
  }
}

beforeEach(() => {
  originalHome = process.env.HOME;
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-heroic-'));
  process.env.HOME = home;
  makeGameDirs('witcher3', 'Hades', 'Prefixes');
  writeJson('store_cache/gog_library.json', {
    games: [{ app_name: '1207664643', title: 'The Witcher 3: Wild Hunt' }],
  });
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe.each([
  [
    'current { installed: [...] } format',
    (entries: unknown[]) => ({ installed: entries }),
  ],
  ['legacy bare array format', (entries: unknown[]) => entries],
])('Heroic GOG installed.json, %s', (_, wrap) => {
  beforeEach(() => {
    writeJson(
      'gog_store/installed.json',
      wrap([
        {
          appName: '1207664643',
          install_path: path.join(gamesDir(), 'witcher3'),
          platform: 'windows',
          is_dlc: false,
        },
      ])
    );
  });

  it('lists only GOG installs as GOG, never Epic games or the Prefixes folder', () => {
    expect(getInstalledGOGGamePaths()).toEqual(['witcher3']);
  });

  it('lists the remaining Heroic folders as Epic, without GOG games or Prefixes', () => {
    expect(getInstalledEpicGamePaths()).toEqual(['Hades']);
  });

  it('resolves the GOG app id by install path', () => {
    expect(getHeroicGOGId(path.join(gamesDir(), 'witcher3'))).toBe('1207664643');
  });

  it('finds the game by a title taken from the library when installed.json has none', () => {
    expect(findGOGGame('The Witcher 3 Wild Hunt')).toBe(
      path.join(gamesDir(), 'witcher3')
    );
  });

  it('attributes a Heroic folder to the store that installed it', () => {
    expect(findEpicGame('witcher3')).toBeNull();
    expect(findEpicGame('Hades')).toBe(path.join(gamesDir(), 'Hades'));
    expect(findGOGGame('Hades')).toBeNull();
  });

  it('keeps an Epic folder whose name matches a stale GOG entry', () => {
    fs.rmSync(path.join(gamesDir(), 'witcher3'), { recursive: true });
    makeGameDirs('other/witcher3');
    writeJson(
      'gog_store/installed.json',
      wrap([{ appName: '1', install_path: path.join(home, 'gone/Hades'), is_dlc: false }])
    );
    expect(getInstalledEpicGamePaths()).toEqual(['Hades', 'other']);
  });
});
