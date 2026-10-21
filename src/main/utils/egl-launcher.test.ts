import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchEglGame } from './egl-launcher';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  spawnOnHost: vi.fn(),
  listLinuxProcesses: vi.fn(),
  resolveUmuRun: vi.fn(),
  getEglDeepLink: vi.fn(),
  getEglLaunchTarget: vi.fn(),
}));

vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('./host-exec', () => ({ spawnOnHost: mocks.spawnOnHost }));
vi.mock('../steam-process/list-linux', () => ({
  listLinuxProcesses: mocks.listLinuxProcesses,
}));
vi.mock('../installer/proton', () => ({
  resolveUmuRun: mocks.resolveUmuRun,
  getUmuEnv: (protonDir: string, prefix: string) => ({
    PROTONPATH: protonDir,
    WINEPREFIX: prefix,
  }),
}));
vi.mock('../game-detector/egl-linux', () => ({
  getEglDeepLink: mocks.getEglDeepLink,
  getEglLaunchTarget: mocks.getEglLaunchTarget,
}));

const GAME_DIR = '/home/deck/Games/DokiDokiLitClubPlus';
const LINK =
  'com.epicgames.launcher://apps/ns%3Aitem%3Aartifact?action=launch&silent=true';
const TARGET = {
  executable: `${GAME_DIR}/Doki Doki Literature Club Plus.exe`,
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
  mocks.resolveUmuRun.mockReturnValue('/lbk/resources/umu/umu-run');
  mocks.spawn.mockImplementation(() => childThat('spawn'));
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

    await expect(launchEglGame(GAME_DIR)).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      '/home/deck/My Apps/EpicGamesLauncher-x86_64.appimage',
      [LINK]
    );
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('cold-starts EGL from where AppImages are kept when it is not running', async () => {
    const downloads = path.join(os.homedir(), 'Downloads');
    fs.mkdirSync(downloads);
    fs.writeFileSync(path.join(downloads, 'EpicGamesLauncher-old.AppImage'), '');
    fs.writeFileSync(path.join(downloads, 'EpicGamesLauncher-x86_64.AppImage'), '', {
      mode: 0o755,
    });

    await expect(launchEglGame(GAME_DIR)).resolves.toBe(true);

    expect(mocks.spawnOnHost).toHaveBeenCalledWith(
      path.join(downloads, 'EpicGamesLauncher-x86_64.AppImage'),
      [LINK]
    );
  });

  it('runs the game through umu on EGL Proton when there is no EGL AppImage', async () => {
    await expect(launchEglGame(GAME_DIR)).resolves.toBe(true);

    expect(mocks.spawnOnHost).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledWith(
      '/lbk/resources/umu/umu-run',
      [TARGET.executable, '-nosplash'],
      expect.objectContaining({
        cwd: GAME_DIR,
        detached: true,
        env: expect.objectContaining({
          PROTONPATH: TARGET.protonDir,
          WINEPREFIX: TARGET.prefix,
          STORE: 'egs',
        }),
      })
    );
  });

  it('fails when neither the link nor a direct run is possible', async () => {
    mocks.getEglDeepLink.mockReturnValue(null);
    mocks.getEglLaunchTarget.mockReturnValue(null);
    await expect(launchEglGame(GAME_DIR)).resolves.toBe(false);

    mocks.getEglLaunchTarget.mockReturnValue(TARGET);
    mocks.resolveUmuRun.mockReturnValue(null);
    await expect(launchEglGame(GAME_DIR)).resolves.toBe(false);

    mocks.resolveUmuRun.mockReturnValue('/lbk/resources/umu/umu-run');
    mocks.spawn.mockImplementation(() => childThat('error'));
    await expect(launchEglGame(GAME_DIR)).resolves.toBe(false);
  });
});
