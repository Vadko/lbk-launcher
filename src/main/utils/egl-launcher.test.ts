import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchEglGame } from './egl-launcher';

const mocks = vi.hoisted(() => ({
  spawnOnHost: vi.fn(),
  listLinuxProcesses: vi.fn(),
  getEglDeepLink: vi.fn(),
  getEglLaunchTarget: vi.fn(),
  readEglLaunchArgs: vi.fn(),
}));

vi.mock('./host-exec', () => ({ spawnOnHost: mocks.spawnOnHost }));
vi.mock('./egl-game-settings', () => ({ readEglLaunchArgs: mocks.readEglLaunchArgs }));
vi.mock('../steam-process/list-linux', () => ({
  listLinuxProcesses: mocks.listLinuxProcesses,
}));
vi.mock('../game-detector/egl-linux', () => ({
  getEglDeepLink: mocks.getEglDeepLink,
  getEglLaunchTarget: mocks.getEglLaunchTarget,
}));

const GAME_DIR = '/home/deck/Games/DokiDokiLitClubPlus';
const LINK =
  'com.epicgames.launcher://apps/ns%3Aitem%3Aartifact?action=launch&silent=true';
const TARGET = {
  gameDir: GAME_DIR,
  executable: `${GAME_DIR}/Binaries/Game.exe`,
  args: ['-nosplash'],
  prefix: '/egl/compat/compatdata/artifact',
  protonDir: '/egl/compat/runtime/GE-Proton10-34',
};

const homes: string[] = [];

function childThat(event: 'spawn' | 'error') {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
  setImmediate(() => child.emit(event, new Error('ENOENT')));
  return child;
}

beforeEach(() => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-egl-launch-'));
  homes.push(home);
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  mocks.listLinuxProcesses.mockResolvedValue([]);
  mocks.getEglDeepLink.mockReturnValue(LINK);
  mocks.getEglLaunchTarget.mockReturnValue(TARGET);
  mocks.spawnOnHost.mockImplementation(() => childThat('spawn'));
  mocks.readEglLaunchArgs.mockReturnValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const home of homes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

describe('launchEglGame', () => {
  it('hands the deep link to the AppImage of the running EGL', async () => {
    mocks.listLinuxProcesses.mockResolvedValue([
      { pid: 1, ppid: 0, comm: 'EpicGamesLaunch', args: 'EpicGamesLauncher' },
      {
        pid: 2,
        ppid: 1,
        comm: 'EpicGamesLaunch',
        args: '/home/deck/My Apps/EpicGamesLauncher-x86_64.appimage',
      },
    ]);

    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      '/home/deck/My Apps/EpicGamesLauncher-x86_64.appimage',
      [LINK]
    );
    expect(mocks.spawnOnHost).toHaveBeenCalledOnce();
  });

  it('cold-starts EGL from where AppImages are kept when it is not running', async () => {
    const downloads = path.join(os.homedir(), 'Downloads');
    fs.mkdirSync(downloads);
    fs.writeFileSync(path.join(downloads, 'EpicGamesLauncher-old.AppImage'), '');
    fs.writeFileSync(path.join(downloads, 'EpicGamesLauncher-x86_64.AppImage'), '', {
      mode: 0o755,
    });

    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      path.join(downloads, 'EpicGamesLauncher-x86_64.AppImage'),
      [LINK]
    );
  });

  it('runs the game the way EGL does, its Proton on the host, when there is no AppImage', async () => {
    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledOnce();
    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      `${TARGET.protonDir}/proton`,
      ['waitforexitandrun', TARGET.executable, '-nosplash'],
      {
        STEAM_COMPAT_CLIENT_INSTALL_PATH: TARGET.protonDir,
        STEAM_COMPAT_DATA_PATH: TARGET.prefix,
        STEAM_COMPAT_INSTALL_PATH: GAME_DIR,
        WINEPREFIX: `${TARGET.prefix}/pfx`,
      },
      `${GAME_DIR}/Binaries`
    );
  });

  it('skips EGL for catalog env, and adds its per-game args to the Proton run', async () => {
    mocks.listLinuxProcesses.mockResolvedValue([
      {
        pid: 2,
        ppid: 1,
        comm: 'EpicGamesLaunch',
        args: '/apps/EpicGamesLauncher.appimage',
      },
    ]);
    mocks.readEglLaunchArgs.mockReturnValue(['-load-mods']);

    await expect(
      launchEglGame(GAME_DIR, 'WINEDLLOVERRIDES="winhttp=n,b" %command% -load-mods')
    ).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      `${TARGET.protonDir}/proton`,
      ['waitforexitandrun', TARGET.executable, '-nosplash', '-load-mods'],
      expect.objectContaining({
        WINEDLLOVERRIDES: 'winhttp=n,b',
        STEAM_COMPAT_DATA_PATH: TARGET.prefix,
      }),
      `${GAME_DIR}/Binaries`
    );
    expect(mocks.spawnOnHost).toHaveBeenCalledOnce();
  });

  it('fails when nothing can be launched or the launch does not spawn', async () => {
    mocks.getEglDeepLink.mockReturnValue(null);
    mocks.getEglLaunchTarget.mockReturnValue(null);
    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(false);

    mocks.getEglLaunchTarget.mockReturnValue(TARGET);
    mocks.spawnOnHost.mockImplementation(() => childThat('error'));
    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(false);

    mocks.getEglDeepLink.mockReturnValue(LINK);
    mocks.listLinuxProcesses.mockResolvedValue([
      {
        pid: 2,
        ppid: 1,
        comm: 'EpicGamesLaunch',
        args: '/apps/EpicGamesLauncher.appimage',
      },
    ]);
    await expect(launchEglGame(GAME_DIR, null)).resolves.toBe(false);
    expect(mocks.spawnOnHost).toHaveBeenLastCalledWith(
      '/apps/EpicGamesLauncher.appimage',
      [LINK]
    );
  });
});
