import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findEpicGame,
  getEpicAppName,
  getEpicManifestAppId,
  getInstalledEpicGamePaths,
} from './epic';

vi.mock('@/main/utils/platform', () => ({
  isLinux: () => false,
  isMacOS: () => false,
  isWindows: () => true,
}));

const dirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function setUpManifests(manifests: Record<string, unknown>[]): void {
  const programData = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-epic-'));
  dirs.push(programData);
  vi.stubEnv('PROGRAMDATA', programData);
  const dir = path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  fs.mkdirSync(dir, { recursive: true });
  manifests.forEach((manifest, i) => {
    fs.writeFileSync(path.join(dir, `${i}.item`), JSON.stringify(manifest));
  });
}

const GAME_DIR = path.join(os.tmpdir(), 'Epic Games', 'Pit');

describe('getEpicManifestAppId', () => {
  it('takes the game, not a DLC installed into its folder', () => {
    const shared = {
      InstallLocation: GAME_DIR,
      DisplayName: 'Pit',
      MainGameAppName: 'Pit',
    };
    setUpManifests([
      { ...shared, CatalogNamespace: 'ns', CatalogItemId: 'dlc', AppName: 'PitDlc' },
      { ...shared, CatalogNamespace: 'ns', CatalogItemId: 'item', AppName: 'Pit' },
    ]);

    expect(getEpicManifestAppId(GAME_DIR)).toBe('ns:item:Pit');
    expect(getEpicAppName(GAME_DIR)).toBe('Pit');
  });

  it('needs all three ids and a matching folder', () => {
    setUpManifests([
      {
        InstallLocation: GAME_DIR,
        DisplayName: 'Pit',
        CatalogItemId: 'item',
        AppName: 'Pit',
      },
    ]);

    expect(getEpicManifestAppId(GAME_DIR)).toBeNull();
    expect(getEpicManifestAppId(path.join(os.tmpdir(), 'Other'))).toBeNull();
  });
});

// The shape EGL 2026 wrote for a real install, ids shortened
function egi(dir: string, state: string, id: string): Record<string, unknown> {
  return {
    v4: {
      installationId: id,
      state,
      dir,
      sandboxId: 'ns',
      itemId: 'item',
      artifactId: `art${id}`,
      manifestData: { launchExe: 'Game.exe' },
    },
  };
}

function setUpInstalledItems(items: Record<string, unknown>[]): string {
  const programData = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-epic-egi-'));
  dirs.push(programData);
  vi.stubEnv('PROGRAMDATA', programData);
  const dir = path.join(
    programData,
    'Epic',
    'EpicOnlineServices',
    'InstallHelper',
    'InstalledItems'
  );
  fs.mkdirSync(dir, { recursive: true });
  items.forEach((item, i) => {
    fs.writeFileSync(path.join(dir, `${i}.egi`), JSON.stringify(item));
  });
  return programData;
}

describe('an EGL that records installs only as .egi items', () => {
  function setUp(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-epic-games-'));
    dirs.push(root);
    const game = path.join(root, 'Snakebird');
    const gone = path.join(root, 'Gone');
    const pending = path.join(root, 'Pending');
    fs.mkdirSync(game);
    fs.mkdirSync(pending);
    setUpInstalledItems([
      egi(game, 'Installed', '1'),
      egi(gone, 'Installed', '2'),
      egi(pending, 'Installing', '3'),
    ]);
    return game;
  }

  it('lists the finished installs whose folder exists', () => {
    setUp();
    expect(getInstalledEpicGamePaths()).toEqual(['Snakebird']);
  });

  it.each([
    ['the folder name', 'Snakebird', true],
    ['the folder name in another case', 'snakebird', true],
    ['a missing folder', 'Gone', false],
    ['an unfinished install', 'Pending', false],
  ])('finds a game by %s', (_label, folder, found) => {
    const game = setUp();
    expect(findEpicGame(folder)).toBe(found ? game : null);
  });

  it('launches by namespace:itemId:artifactId', () => {
    const game = setUp();
    expect(getEpicAppName(game)).toBe('ns:item:art1');
  });
});
