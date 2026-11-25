import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEglDeepLink,
  getEglInstallationsPath,
  getEglInstallDirs,
  getEglLaunchTarget,
  isEglInstall,
  isEglPreviewInstalled,
} from './egl-v2';
import { findEpicGame, getEpicAppName, getInstalledEpicGamePaths } from './epic';

const platform = vi.hoisted(() => ({ windows: false }));

vi.mock('../utils/platform', () => ({
  isLinux: () => !platform.windows,
  isMacOS: () => false,
  isWindows: () => platform.windows,
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
  platform.windows = false;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
      gameDir: dir,
      executable: path.join(dir, 'Doki Doki Literature Club Plus.exe'),
      args: [],
      prefix: path.join(
        path.dirname(runtime),
        'compatdata/c5109bdceb3a453bb38c2fdc964ddee8'
      ),
      protonDir: path.join(runtime, 'GE-Proton10-34'),
    });
  });

  it('passes the quoted launch command and turns Windows separators into folders', () => {
    const dir = setUpHome((gameDir) => [
      ddlcRecord(gameDir, {
        complete: true,
        launchExecutable: 'Game\\Binaries\\Win64\\Game.exe',
        launchCommand: ' -SaveToUserDir  -name "Two Words" ',
      }),
    ]);
    fs.mkdirSync(path.join(dir, 'Game/Binaries/Win64'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Game/Binaries/Win64/Game.exe'), '');
    pinProton('GE-Proton10-34');

    expect(getEglLaunchTarget(dir)).toMatchObject({
      executable: path.join(dir, 'Game/Binaries/Win64/Game.exe'),
      args: ['-SaveToUserDir', '-name', 'Two Words'],
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

const SNAKEBIRD_ID = '2696F0EB5BF03ED37F5F5A301DC0F37C';
const SNAKEBIRD_APP_ID =
  'efc30c2078a2499ab979d198255e2e4b:1cb5e018771c43ee96aa553b450e9f95:8337d1f975514d35ad0c1176e8a29f26';

// Shaped after the real log of the Windows preview 0.122.0
function snakebirdRecord(dir: string, fields: Record<string, unknown>) {
  const [namespace, itemId, artifactId] = SNAKEBIRD_APP_ID.split(':');
  return {
    installationId: SNAKEBIRD_ID,
    dir,
    platform: 'Windows',
    namespace,
    itemId,
    artifactId,
    tags: [''],
    sidecar: { revision: 0 },
    launchCommand: '',
    launchExecutable: 'Snakebird Complete.exe',
    writtenAt: '2026-11-25T01:13:47Z',
    ...fields,
  };
}

function setUpWindows(lines: (dir: string) => unknown[]) {
  platform.windows = true;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-egl-win-'));
  homes.push(home);
  const localAppData = path.join(home, 'AppData', 'Local');
  vi.stubEnv('LOCALAPPDATA', localAppData);
  vi.stubEnv('PROGRAMDATA', path.join(home, 'ProgramData'));
  const dir = path.join(home, 'Epic Games', 'SnakebirdCompletezp91Z');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Snakebird Complete.exe'), '');
  const log = path.join(localAppData, 'com.epicgames.eglv2', 'installations.jsonl');
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.writeFileSync(
    log,
    [{ version: 1, writtenAt: '2026-11-25T01:11:49Z', entries: 15 }, ...lines(dir)]
      .map((line) => JSON.stringify(line))
      .join('\n')
  );
  return { home, dir, log };
}

describe('EGLv2 installations on Windows', () => {
  it('reads the log under LOCALAPPDATA', () => {
    const { log } = setUpWindows(() => []);

    expect(getEglInstallationsPath()).toBe(log);
  });

  it('detects a finished install and launches it by namespace, item and artifact', () => {
    const { dir } = setUpWindows((gameDir) => [
      snakebirdRecord(gameDir, { complete: false, pendingVersion: 'Win.1.5' }),
      snakebirdRecord(gameDir, { complete: true, version: 'Win.1.5' }),
    ]);

    expect(getInstalledEpicGamePaths()).toEqual(['SnakebirdCompletezp91Z']);
    expect(findEpicGame('SnakebirdCompletezp91Z')).toBe(dir);
    expect(getEpicAppName(dir)).toBe(SNAKEBIRD_APP_ID);
  });

  it.each([
    ['a trailing separator', (dir: string) => `${dir}${path.sep}`],
    ['another case', (dir: string) => dir.toUpperCase()],
  ])('matches the folder written with %s', (_, spell) => {
    const { dir } = setUpWindows((gameDir) => [
      snakebirdRecord(gameDir, { complete: true }),
    ]);

    expect(isEglInstall(spell(dir))).toBe(true);
  });

  it('knows the preview by its per-user launcher', () => {
    const { home } = setUpWindows(() => []);
    expect(isEglPreviewInstalled()).toBe(false);

    const launcher = path.join(home, 'AppData/Local/Epic Games/Launcher');
    fs.mkdirSync(launcher, { recursive: true });
    fs.writeFileSync(path.join(launcher, 'EpicGamesLauncher.exe'), '');

    expect(isEglPreviewInstalled()).toBe(true);
  });

  it('finds the folder the preview recorded before an EGL v1 item of the same name', () => {
    const { home, dir } = setUpWindows((gameDir) => [
      snakebirdRecord(gameDir, { complete: true }),
    ]);
    const v1Dir = path.join(home, 'Program Files/Epic Games/SnakebirdCompletezp91Z');
    fs.mkdirSync(v1Dir, { recursive: true });
    const items = path.join(
      home,
      'ProgramData/Epic/EpicOnlineServicesShared/InstallHelper/InstalledItems'
    );
    fs.mkdirSync(items, { recursive: true });
    fs.writeFileSync(
      path.join(items, `${SNAKEBIRD_ID}.egi`),
      JSON.stringify({
        v4: { installationId: SNAKEBIRD_ID, state: 'Installed', dir: v1Dir },
      })
    );

    expect(findEpicGame('SnakebirdCompletezp91Z')).toBe(dir);
  });

  it("takes the preview's id over an EGL v1 manifest of the same folder", () => {
    const { home, dir } = setUpWindows((gameDir) => [
      snakebirdRecord(gameDir, { complete: true }),
    ]);
    const manifests = path.join(
      home,
      'ProgramData/Epic/EpicGamesLauncher/Data/Manifests'
    );
    fs.mkdirSync(manifests, { recursive: true });
    fs.writeFileSync(
      path.join(manifests, 'snakebird.item'),
      JSON.stringify({
        InstallLocation: dir,
        DisplayName: 'Snakebird Complete',
        AppName: '8337d1f975514d35ad0c1176e8a29f26',
      })
    );

    expect(getEpicAppName(dir)).toBe(SNAKEBIRD_APP_ID);
  });

  it('leaves Proton to the Linux build', () => {
    const { home, dir } = setUpWindows((gameDir) => [
      snakebirdRecord(gameDir, { complete: true }),
    ]);
    const runtime = path.join(home, 'AppData/Local/com.epicgames.eglv2/compat/runtime');
    fs.mkdirSync(path.join(runtime, 'GE-Proton10-34'), { recursive: true });
    fs.writeFileSync(path.join(runtime, 'GE-Proton10-34', 'proton'), '');
    fs.writeFileSync(
      path.join(runtime, 'pin-cache.json'),
      JSON.stringify({ version: 'GE-Proton10-34' })
    );

    expect(getEglLaunchTarget(dir)).toBeNull();
  });
});
