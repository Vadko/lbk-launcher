import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEglDeepLink,
  getEglInstallationsPath,
  getEglInstallDirs,
  getEglLaunchTarget,
} from './egl-linux';
import { findEpicGame, getInstalledEpicGamePaths } from './epic';

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

const homes: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const home of homes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

const DDLC_ID = 'BE9DAD2A0D0AD224874A41373DBE0F2B';

// Shaped after a real EGLv2 0.100.0 log: header, then one full record per state change
function ddlcRecord(dir: string, fields: Record<string, unknown>) {
  return {
    installationId: DDLC_ID,
    dir,
    platform: 'Windows',
    namespace: '1311a5735ed844c0b3c47027cab321f0',
    itemId: 'f1b123b2f48840b5b2b0322541fcbddb',
    artifactId: 'c5109bdceb3a453bb38c2fdc964ddee8',
    tags: [''],
    sidecar: { revision: 0 },
    launchCommand: '',
    launchExecutable: 'Doki Doki Literature Club Plus.exe',
    writtenAt: '2026-10-21T19:51:29Z',
    ...fields,
  };
}

function setUpHome(lines: (dir: string) => unknown[]) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-egl-'));
  homes.push(home);
  vi.stubEnv('HOME', home);
  // os.homedir() reads USERPROFILE on Windows
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('XDG_DATA_HOME', undefined);
  vi.stubEnv('FLATPAK_ID', undefined);
  const dir = path.join(home, 'Games', 'DokiDokiLitClubPlus');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Doki Doki Literature Club Plus.exe'), '');
  const log = getEglInstallationsPath() ?? '';
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.writeFileSync(
    log,
    [{ version: 1, writtenAt: '2026-10-21T19:46:59Z', entries: 0 }, ...lines(dir)]
      .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
      .join('\n')
  );
  return dir;
}

function pinProton(version: string, folder = version): string {
  const runtime = path.join(
    path.dirname(getEglInstallationsPath() ?? ''),
    'compat/runtime'
  );
  fs.mkdirSync(runtime, { recursive: true });
  fs.mkdirSync(path.join(runtime, folder), { recursive: true });
  fs.writeFileSync(path.join(runtime, folder, 'proton'), '');
  fs.writeFileSync(path.join(runtime, 'pin-cache.json'), JSON.stringify({ version }));
  return runtime;
}

describe('EGLv2 installations on Linux', () => {
  it('detects a finished install by its folder name', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: false, pendingVersion: 'Windows_1.0.7' }),
      ddlcRecord(gameDir, { complete: true, version: 'Windows_1.0.7' }),
    ]);

    expect(getInstalledEpicGamePaths()).toContain('DokiDokiLitClubPlus');
    expect(findEpicGame('dokidokilitclubplus')).toBe(dir);
  });

  it('ignores an install that is still downloading', () => {
    setUpHome((gameDir) => [ddlcRecord(gameDir, { complete: false })]);

    expect(getEglInstallDirs()).toEqual([]);
  });

  it('lets the last record of an installation win', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true }),
      { installationId: DDLC_ID, deleted: true },
      ddlcRecord(gameDir, { complete: true }),
    ]);

    expect(getEglInstallDirs()).toEqual([dir]);
  });

  it('drops an install whose last record deletes it', () => {
    setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true }),
      { installationId: DDLC_ID, deleted: true },
    ]);

    expect(getEglInstallDirs()).toEqual([]);
  });

  it('skips malformed lines and DLC records', () => {
    const dir = setUpHome((gameDir) => [
      '{not json',
      ddlcRecord(gameDir, {
        installationId: 'DLC',
        complete: true,
        parentInstallationId: DDLC_ID,
      }),
      ddlcRecord(gameDir, { complete: true }),
    ]);

    expect(getEglInstallDirs()).toEqual([dir]);
  });

  it('forgets a folder removed after the log was read', () => {
    const dir = setUpHome((gameDir) => [ddlcRecord(gameDir, { complete: true })]);
    expect(getEglInstallDirs()).toEqual([dir]);

    fs.rmSync(dir, { recursive: true });

    expect(getEglInstallDirs()).toEqual([]);
    expect(findEpicGame('DokiDokiLitClubPlus')).toBeNull();
  });

  it('reads the log under XDG_DATA_HOME, except inside our Flatpak', () => {
    setUpHome(() => []);
    vi.stubEnv('XDG_DATA_HOME', '/custom/data');

    expect(getEglInstallationsPath()).toBe(
      path.join('/custom/data', 'com.epicgames.eglv2/installations.jsonl')
    );

    vi.stubEnv('FLATPAK_ID', 'ua.lbk.Launcher');

    expect(getEglInstallationsPath()).toBe(
      path.join(os.homedir(), '.local/share/com.epicgames.eglv2/installations.jsonl')
    );
  });

  it('builds the deep link EGL resolves from namespace, item and artifact', () => {
    const dir = setUpHome((gameDir) => [ddlcRecord(gameDir, { complete: true })]);

    expect(getEglDeepLink(dir)).toBe(
      'com.epicgames.launcher://apps/1311a5735ed844c0b3c47027cab321f0%3Af1b123b2f48840b5b2b0322541fcbddb%3Ac5109bdceb3a453bb38c2fdc964ddee8?action=launch&silent=true'
    );
    expect(getEglDeepLink('/elsewhere')).toBeNull();
  });

  it('runs on the GE-Proton EGL pinned, in the prefix of the artifact', () => {
    const dir = setUpHome((gameDir) => [ddlcRecord(gameDir, { complete: true })]);
    const runtime = pinProton('GE-Proton10-34');

    expect(getEglLaunchTarget(dir)).toEqual({
      executable: path.join(dir, 'Doki Doki Literature Club Plus.exe'),
      args: [],
      prefix: path.join(
        path.dirname(runtime),
        'compatdata/c5109bdceb3a453bb38c2fdc964ddee8'
      ),
      protonDir: path.join(runtime, 'GE-Proton10-34'),
    });
  });

  it('passes the launch command and turns Windows separators into folders', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, {
        complete: true,
        launchExecutable: 'Game\\Binaries\\Win64\\Game.exe',
        launchCommand: ' -SaveToUserDir  -nosplash ',
      }),
    ]);
    fs.mkdirSync(path.join(dir, 'Game/Binaries/Win64'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Game/Binaries/Win64/Game.exe'), '');
    pinProton('GE-Proton10-34');

    expect(getEglLaunchTarget(dir)).toMatchObject({
      executable: path.join(dir, 'Game/Binaries/Win64/Game.exe'),
      args: ['-SaveToUserDir', '-nosplash'],
    });
  });

  it('cannot run a missing executable or one outside the game folder', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true, launchExecutable: 'Gone.exe' }),
    ]);
    pinProton('GE-Proton10-34');
    expect(getEglLaunchTarget(dir)).toBeNull();

    const other = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true, launchExecutable: '../Outside.exe' }),
    ]);
    fs.writeFileSync(path.join(path.dirname(other), 'Outside.exe'), '');
    pinProton('GE-Proton10-34');
    expect(getEglLaunchTarget(other)).toBeNull();
  });

  it('needs the Proton pin-cache.json names, inside the runtime folder', () => {
    const dir = setUpHome((gameDir) => [ddlcRecord(gameDir, { complete: true })]);
    expect(getEglLaunchTarget(dir)).toBeNull();

    pinProton('../escape');
    expect(getEglLaunchTarget(dir)).toBeNull();
  });

  it('needs the artifact for the prefix, and keeps the prefix inside compatdata', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true, artifactId: undefined }),
    ]);
    pinProton('GE-Proton10-34');
    expect(getEglLaunchTarget(dir)).toBeNull();

    const other = setUpHome((gameDir) => [
      ddlcRecord(gameDir, { complete: true, artifactId: '../runtime' }),
    ]);
    pinProton('GE-Proton10-34');
    expect(getEglLaunchTarget(other)).toBeNull();
  });
});
