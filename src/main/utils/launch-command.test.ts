import { describe, expect, it } from 'vitest';
import { parseCatalogLaunchOptions, parseLaunchCommand } from './launch-command';

describe('parseLaunchCommand', () => {
  it('splits env assignments, %command% and game args', () => {
    expect(
      parseLaunchCommand(
        `WINEDLLOVERRIDES="winhttp=n,b" DXVK_HUD='fps' %command% -lang uk`
      )
    ).toEqual({
      env: { WINEDLLOVERRIDES: 'winhttp=n,b', DXVK_HUD: 'fps' },
      args: ['-lang', 'uk'],
      argsText: '-lang uk',
    });
  });

  it('treats a value without %command% as game args, quotes included', () => {
    expect(parseLaunchCommand('-language ukr -name "Two Words"')).toEqual({
      env: {},
      args: ['-language', 'ukr', '-name', 'Two Words'],
      argsText: '-language ukr -name "Two Words"',
    });
  });

  it('keeps variable references literal instead of expanding them', () => {
    expect(parseLaunchCommand('-log $HOME/game.log')).toEqual({
      env: {},
      args: ['-log', '$HOME/game.log'],
      argsText: '-log $HOME/game.log',
    });
  });

  it('refuses wrappers and shell operators it cannot run without a shell', () => {
    expect(
      parseLaunchCommand(`bash -c 'exec "\${@/A.exe/B.exe}"' -- %command%`)
    ).toBeNull();
    expect(parseLaunchCommand('cmd /c "set X=1 && %command%"')).toBeNull();
    expect(parseLaunchCommand('X=1 %command% && echo done')).toBeNull();
    expect(parseLaunchCommand('"%command%" --skip-launcher')).toBeNull();
  });

  it('expands {GAME_DIR} in catalog options before parsing', () => {
    expect(
      parseCatalogLaunchOptions('%command% -mods "{GAME_DIR}/Mods"', '/games/My Game')
    ).toEqual({
      env: {},
      args: ['-mods', '/games/My Game/Mods'],
      argsText: '-mods "/games/My Game/Mods"',
    });
    expect(
      parseCatalogLaunchOptions('%command% -mods {GAME_DIR}/Mods', '/games/My Game')
    ).toBeNull();
  });
});
