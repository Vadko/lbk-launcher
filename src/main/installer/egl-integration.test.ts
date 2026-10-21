import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '@/shared/types';
import { applyEglIntegration } from './egl-integration';

const mocks = vi.hoisted(() => ({
  getEglInstallDirs: vi.fn(),
  addEglLaunchArgs: vi.fn(),
}));

vi.mock('@/main/game-detector/egl-linux', () => ({
  getEglInstallDirs: mocks.getEglInstallDirs,
}));
vi.mock('@/main/utils/egl-game-settings', () => ({
  addEglLaunchArgs: mocks.addEglLaunchArgs,
}));

const DIR = '/home/deck/Games/CassetteBeasts';
const EPIC = { platform: 'epic' as const, path: DIR };

function game(linuxOptions: string | null): Game {
  return { steam_launch_options_linux: linuxOptions } as Game;
}

beforeEach(() => {
  mocks.getEglInstallDirs.mockReturnValue([DIR]);
  mocks.addEglLaunchArgs.mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('applyEglIntegration', () => {
  it('writes the catalog args into EGL as written', () => {
    expect(applyEglIntegration(game('%command% -mod=a,b "Two Words"'), EPIC)).toEqual({});
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(DIR, '-mod=a,b "Two Words"');
  });

  it('says env assignments work only when LBK starts the game', () => {
    expect(
      applyEglIntegration(
        game('WINEDLLOVERRIDES="winhttp=n,b" %command% -load-mods'),
        EPIC
      )
    ).toEqual({
      launchOptionsError:
        'Epic Games Launcher не передає грі змінні середовища, тож переклад працюватиме, лише якщо запускати гру з лаунчера',
    });
    expect(mocks.addEglLaunchArgs).toHaveBeenCalledWith(DIR, '-load-mods');
  });

  it('leaves other stores, other Epic installs and games without options alone', () => {
    expect(
      applyEglIntegration(game('-load-mods'), { platform: 'steam', path: DIR })
    ).toEqual({});
    expect(
      applyEglIntegration(game('-load-mods'), { platform: 'epic', path: '/heroic/Game' })
    ).toEqual({});
    expect(applyEglIntegration(game(null), EPIC)).toEqual({});

    expect(mocks.addEglLaunchArgs).not.toHaveBeenCalled();
  });

  it('explains options it cannot apply and a failed write', () => {
    expect(applyEglIntegration(game(`bash -c 'x' -- %command%`), EPIC)).toEqual({
      launchOptionsError:
        'вони виконуються лише через оболонку, якою їх запускає Steam, а Epic Games Launcher так не вміє',
    });

    mocks.getEglInstallDirs.mockReturnValue(['/games/My Game']);
    expect(
      applyEglIntegration(game('%command% -mods {GAME_DIR}/Mods'), {
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
    expect(applyEglIntegration(game('-load-mods'), EPIC)).toEqual(failed);

    mocks.addEglLaunchArgs.mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(applyEglIntegration(game('-load-mods'), EPIC)).toEqual(failed);
  });
});
