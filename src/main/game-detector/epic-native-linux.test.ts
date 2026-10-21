import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findEpicGame, getEpicAppName, getInstalledEpicGamePaths } from './epic';
import {
  getEpicLauncherInstallationsPath,
  getEpicLauncherInstallPaths,
} from './epic-launcher-installations';

vi.mock('../utils/platform', () => ({
  isLinux: () => true,
  isMacOS: () => false,
  isWindows: () => false,
}));

vi.mock('./gog', () => ({
  getHeroicGogInstallFolders: () => [],
}));

vi.mock('./heroic', () => ({
  findGameInHeroicDirs: () => null,
  getAllHeroicGameFolders: () => [],
  getHeroicConfigPaths: () => [],
}));

vi.mock('./lutris', () => ({
  getLutrisEpicGameDirNames: () => [],
  getLutrisEpicLibrary: () => [],
  getLutrisInstalledEpicPathsFull: () => [],
}));

let home: string;
let gamePath: string;

function writeInstallations(records: unknown[]): void {
  const installationsPath = getEpicLauncherInstallationsPath();
  if (!installationsPath) {
    throw new Error('Epic Launcher installations path is unavailable');
  }

  fs.mkdirSync(path.dirname(installationsPath), { recursive: true });
  fs.writeFileSync(
    installationsPath,
    [
      JSON.stringify({ version: 1, writtenAt: '2026-10-21T19:07:59Z', entries: 0 }),
      ...records.map((record) => JSON.stringify(record)),
    ].join('\n')
  );
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-epic-linux-'));
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  gamePath = path.join(home, 'Games', 'AmnesiaTheDarkDescent');
  fs.mkdirSync(gamePath, { recursive: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('Epic Launcher Linux installations', () => {
  it('reads completed existing game directories from installations.jsonl', () => {
    writeInstallations([
      {
        installationId: 'installed-game',
        complete: false,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'AmnesiaTheDarkDescent',
      },
      {
        installationId: 'installed-game',
        complete: true,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'AmnesiaTheDarkDescent',
      },
      {
        installationId: 'pending-game',
        complete: false,
        dir: path.join(home, 'Games', 'PendingGame'),
        platform: 'Windows',
        artifactId: 'PendingGame',
      },
      {
        installationId: 'deleted-game',
        complete: true,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'DeletedGame',
      },
      {
        installationId: 'deleted-game',
        deleted: true,
      },
      {
        installationId: 'missing-game',
        complete: true,
        dir: path.join(home, 'Games', 'RemovedGame'),
        platform: 'Windows',
        artifactId: 'RemovedGame',
      },
    ]);

    expect(getEpicLauncherInstallPaths()).toEqual([gamePath]);
    expect(getInstalledEpicGamePaths()).toContain('AmnesiaTheDarkDescent');
  });

  it('resolves installed game folders for translation installation', () => {
    writeInstallations([
      {
        installationId: 'installed-game',
        complete: true,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'AmnesiaTheDarkDescent',
      },
    ]);

    expect(findEpicGame('AmnesiaTheDarkDescent')).toBe(gamePath);
  });

  it('provides the Epic app identifier used to launch the game', () => {
    writeInstallations([
      {
        installationId: 'installed-game',
        complete: true,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'AmnesiaTheDarkDescent',
      },
    ]);

    expect(getEpicAppName(gamePath)).toBe('AmnesiaTheDarkDescent');
  });

  it('uses the artifact ID when an installation record has no installation ID', () => {
    writeInstallations([
      {
        complete: true,
        dir: gamePath,
        platform: 'Windows',
        artifactId: 'AmnesiaTheDarkDescent',
      },
    ]);

    expect(getEpicLauncherInstallPaths()).toEqual([gamePath]);
    expect(getEpicAppName(gamePath)).toBe('AmnesiaTheDarkDescent');
  });
});
