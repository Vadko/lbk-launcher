import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@/shared/types';
import { applyEglIntegration } from './egl-integration';

const mocks = vi.hoisted(() => ({
  getEglInstallDirs: vi.fn(),
  addEglLaunchArgs: vi.fn(),
  getEpicManifestAppId: vi.fn(),
  setEglWindowsLaunchArgs: vi.fn(),
  isWindows: vi.fn(),
}));

vi.mock('@/main/game-detector/egl-linux', () => ({
  getEglInstallDirs: mocks.getEglInstallDirs,
}));
vi.mock('@/main/utils/egl-game-settings', () => ({
  addEglLaunchArgs: mocks.addEglLaunchArgs,
}));
vi.mock('@/main/game-detector/epic', () => ({
  getEpicManifestAppId: mocks.getEpicManifestAppId,
}));
vi.mock('@/main/utils/egl-windows-settings', () => ({
  setEglWindowsLaunchArgs: mocks.setEglWindowsLaunchArgs,
}));
vi.mock('@/main/utils/platform', () => ({
  isWindows: mocks.isWindows,
  isLinux: () => !mocks.isWindows(),
}));

const DIR = '/home/deck/Games/CassetteBeasts';
const EPIC = { platform: 'epic' as const, path: DIR };

function game(linuxOptions: string | null, windowsOptions: string | null = null): Game {
  return {
    steam_launch_options_linux: linuxOptions,
    steam_launch_options_windows: windowsOptions,
  } as Game;
}

beforeEach(() => {
  mocks.getEglInstallDirs.mockReturnValue([DIR]);
  mocks.addEglLaunchArgs.mockReturnValue(true);
  mocks.isWindows.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('applyEglIntegration on Linux', () => {
  it('writes the catalog args into EGL as written', async () => {
    expect(
      await applyEglIntegration(game('%command% -mod=a,b "Two Words"'), EPIC)
    ).toEqual({});
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(DIR, '-mod=a,b "Two Words"');
  });

  it('says env assignments work only when LBK starts the game', async () => {
    expect(
      await applyEglIntegration(
        game('WINEDLLOVERRIDES="winhttp=n,b" %command% -load-mods'),
        EPIC
      )
    ).toEqual({
      eglLaunchOptionsNotes: [
        'Epic Games Launcher не передає грі змінні середовища, тож переклад працюватиме, лише якщо запускати гру кнопкою «Грати» в LBK Launcher.',
      ],
    });
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(DIR, '-load-mods');
  });

  it('leaves other stores, other Epic installs and games without options alone', async () => {
    expect(
      await applyEglIntegration(game('-load-mods'), { platform: 'steam', path: DIR })
    ).toEqual({});
    expect(
      await applyEglIntegration(game('-load-mods'), {
        platform: 'epic',
        path: '/heroic/Game',
      })
    ).toEqual({});
    expect(await applyEglIntegration(game(null), EPIC)).toEqual({});

    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });

  it('explains options it cannot apply and a failed write', async () => {
    expect(await applyEglIntegration(game(`bash -c 'x' -- %command%`), EPIC)).toEqual({
      launchOptionsError:
        'вони виконуються лише через оболонку, якою їх запускає Steam, а Epic Games Launcher так не вміє',
    });

    mocks.getEglInstallDirs.mockReturnValue(['/games/My Game']);
    expect(
      await applyEglIntegration(game('%command% -mods {GAME_DIR}/Mods'), {
        platform: 'epic',
        path: '/games/My Game',
      })
    ).toEqual({
      launchOptionsError: 'Не вдалося визначити теку гри для параметрів запуску',
    });
    mocks.getEglInstallDirs.mockReturnValue([DIR]);

    const failed = {
      launchOptionsError: 'не вдалося змінити налаштування гри в Epic Games Launcher',
    };
    mocks.addEglLaunchArgs.mockReturnValue(false);
    expect(await applyEglIntegration(game('-load-mods'), EPIC)).toEqual(failed);

    mocks.addEglLaunchArgs.mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(await applyEglIntegration(game('-load-mods'), EPIC)).toEqual(failed);
  });
});

describe('applyEglIntegration on Windows', () => {
  const WIN_DIR = 'C:\\Program Files\\Epic Games\\Pit';
  const WIN_EPIC = { platform: 'epic' as const, path: WIN_DIR };
  const APP_ID = 'ns:item:Pit';

  beforeEach(() => {
    mocks.isWindows.mockReturnValue(true);
    mocks.getEpicManifestAppId.mockReturnValue(APP_ID);
    mocks.setEglWindowsLaunchArgs.mockResolvedValue('written');
  });

  it('writes the Windows args under the manifest app id', async () => {
    expect(
      await applyEglIntegration(game('-linux', '-load-mods "Two Words"'), WIN_EPIC)
    ).toEqual({});
    expect(mocks.setEglWindowsLaunchArgs).toHaveBeenCalledWith(
      APP_ID,
      '-load-mods "Two Words"'
    );
    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });

  it('says when the args wait for EGL to quit, and when they could not be written', async () => {
    mocks.setEglWindowsLaunchArgs.mockResolvedValue('queued');
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual({
      eglLaunchOptionsNotes: [
        expect.stringContaining('щойно ви вийдете з Epic Games Launcher'),
      ],
    });
    expect(await applyEglIntegration(game(null, 'FOO=1 %command% -a'), WIN_EPIC)).toEqual(
      {
        eglLaunchOptionsNotes: [
          expect.stringContaining('щойно ви вийдете з Epic Games Launcher'),
          expect.stringContaining('не передає грі змінні середовища'),
        ],
      }
    );

    const failed = {
      launchOptionsError: 'не вдалося змінити налаштування гри в Epic Games Launcher',
    };
    mocks.setEglWindowsLaunchArgs.mockResolvedValue('failed');
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual(failed);
    mocks.setEglWindowsLaunchArgs.mockRejectedValue(new Error('EBUSY'));
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual(failed);
  });

  it('writes the args but warns about env assignments, which nothing on Windows passes on', async () => {
    expect(await applyEglIntegration(game(null, 'FOO=1 %command% -a'), WIN_EPIC)).toEqual(
      {
        eglLaunchOptionsNotes: [
          'Epic Games Launcher не передає грі змінні середовища, тож без них переклад може не працювати.',
        ],
      }
    );
    expect(mocks.setEglWindowsLaunchArgs).toHaveBeenCalledWith(APP_ID, '-a');
  });

  it('skips games without a manifest or without Windows options', async () => {
    expect(await applyEglIntegration(game('-a', null), WIN_EPIC)).toEqual({});
    expect(mocks.getEpicManifestAppId).not.toHaveBeenCalled();
    mocks.getEpicManifestAppId.mockReturnValue(null);
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual({});
    expect(mocks.setEglWindowsLaunchArgs).not.toHaveBeenCalled();
  });
});
