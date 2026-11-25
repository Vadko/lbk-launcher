import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { Game } from '@/shared/types';
import { applyEglIntegration } from './egl-integration';

const mocks = vi.hoisted(() => ({
  eglInstallDirs: vi.fn(),
  isEglPreviewInstalled: vi.fn(),
  addEglLaunchArgs: vi.fn(),
  getEpicManifestAppId: vi.fn(),
  setEglWindowsLaunchArgs: vi.fn(),
  isWindows: vi.fn(),
}));

vi.mock('@/main/game-detector/egl-v2', () => ({
  isEglInstall: (dir: string) => mocks.eglInstallDirs().includes(dir),
  isEglPreviewInstalled: mocks.isEglPreviewInstalled,
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
  mocks.eglInstallDirs.mockReturnValue([DIR]);
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
      eglLaunchOptionsNotes: [t('launchOptions.eglEnvOnlyFromLbk')],
    });
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(DIR, '-load-mods');
  });

  it.each([
    ['another store', game('-load-mods'), { platform: 'steam' as const, path: DIR }, {}],
    ['a game without options', game(null), EPIC, {}],
    [
      'an Epic install EGL does not know (Heroic, Lutris)',
      game('-load-mods'),
      { platform: 'epic' as const, path: '/heroic/Game' },
      { launchOptionsError: t('launchOptions.eglGameNotFound') },
    ],
  ])('writes nothing for %s', async (_, catalogGame, target, expected) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await applyEglIntegration(catalogGame, target)).toEqual(expected);
    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });

  it('explains options it cannot apply and a failed write', async () => {
    expect(await applyEglIntegration(game(`bash -c 'x' -- %command%`), EPIC)).toEqual({
      launchOptionsError: t('launchOptions.eglNeedsShell'),
    });

    mocks.eglInstallDirs.mockReturnValue(['/games/My Game']);
    expect(
      await applyEglIntegration(game('%command% -mods {GAME_DIR}/Mods'), {
        platform: 'epic',
        path: '/games/My Game',
      })
    ).toEqual({
      launchOptionsError: t('launchOptions.gameDirUnresolved'),
    });
    mocks.eglInstallDirs.mockReturnValue([DIR]);

    const failed = {
      launchOptionsError: t('launchOptions.eglWriteFailed'),
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
      eglLaunchOptionsNotes: [t('launchOptions.eglQueued')],
    });
    expect(await applyEglIntegration(game(null, 'FOO=1 %command% -a'), WIN_EPIC)).toEqual(
      {
        eglLaunchOptionsNotes: [
          t('launchOptions.eglQueued'),
          t('launchOptions.eglEnvUnsupported'),
        ],
      }
    );

    const failed = {
      launchOptionsError: t('launchOptions.eglWriteFailed'),
    };
    mocks.setEglWindowsLaunchArgs.mockResolvedValue('failed');
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual(failed);
    mocks.setEglWindowsLaunchArgs.mockRejectedValue(new Error('EBUSY'));
    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual(failed);
  });

  it('writes the args but warns about env assignments, which nothing on Windows passes on', async () => {
    expect(await applyEglIntegration(game(null, 'FOO=1 %command% -a'), WIN_EPIC)).toEqual(
      {
        eglLaunchOptionsNotes: [t('launchOptions.eglEnvUnsupported')],
      }
    );
    expect(mocks.setEglWindowsLaunchArgs).toHaveBeenCalledWith(APP_ID, '-a');
  });

  it.each([
    ['the installed preview, over a v1 manifest', true, APP_ID],
    ['a log with no v1 manifest beside it', false, null],
  ])('writes the args into the EGL preview log for %s', async (_, preview, v1AppId) => {
    mocks.eglInstallDirs.mockReturnValue([WIN_DIR]);
    mocks.isEglPreviewInstalled.mockReturnValue(preview);
    mocks.getEpicManifestAppId.mockReturnValue(v1AppId);

    expect(
      await applyEglIntegration(game('-linux', '-load-mods "Two Words"'), WIN_EPIC)
    ).toEqual({});
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(
      WIN_DIR,
      '-load-mods "Two Words"'
    );
    expect(mocks.setEglWindowsLaunchArgs).not.toHaveBeenCalled();
  });

  it('leaves the log of an uninstalled preview to EGL v1', async () => {
    mocks.eglInstallDirs.mockReturnValue([WIN_DIR]);
    mocks.isEglPreviewInstalled.mockReturnValue(false);

    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual({});
    expect(mocks.setEglWindowsLaunchArgs).toHaveBeenCalledWith(APP_ID, '-a');
    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });

  it('warns about env assignments, which the EGL preview does not pass on either', async () => {
    mocks.eglInstallDirs.mockReturnValue([WIN_DIR]);
    mocks.isEglPreviewInstalled.mockReturnValue(true);

    expect(await applyEglIntegration(game(null, 'FOO=1 %command% -a'), WIN_EPIC)).toEqual(
      {
        eglLaunchOptionsNotes: [t('launchOptions.eglEnvUnsupported')],
      }
    );
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(WIN_DIR, '-a');
  });

  it('skips games without Windows options', async () => {
    expect(await applyEglIntegration(game('-a', null), WIN_EPIC)).toEqual({});
    expect(mocks.getEpicManifestAppId).not.toHaveBeenCalled();
    expect(mocks.setEglWindowsLaunchArgs).not.toHaveBeenCalled();
  });

  it('says the options went nowhere when EGL has no manifest for the game', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.getEpicManifestAppId.mockReturnValue(null);

    expect(await applyEglIntegration(game(null, '-a'), WIN_EPIC)).toEqual({
      launchOptionsError: t('launchOptions.eglGameNotFound'),
    });
    expect(mocks.setEglWindowsLaunchArgs).not.toHaveBeenCalled();
  });
});

describe('applyEglIntegration for a copy in a CrossOver bottle', () => {
  const IN_BOTTLE = {
    ...EPIC,
    wine: { prefix: '/Bottles/a', launcher: 'crossover' as const, label: 'a' },
  };

  it.each([
    [
      'says the Windows launch options were not written',
      '-a',
      { launchOptionsError: t('launchOptions.eglInWine') },
    ],
    ['has nothing to say without them', null, {}],
  ])('%s', async (_case, windowsOptions, expected) => {
    expect(await applyEglIntegration(game('-linux', windowsOptions), IN_BOTTLE)).toEqual(
      expected
    );
    expect(mocks.setEglWindowsLaunchArgs).not.toHaveBeenCalled();
    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });
});
