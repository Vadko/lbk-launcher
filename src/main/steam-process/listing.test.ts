import { describe, expect, it, vi } from 'vitest';
import { parseLinuxPsOutput } from '@/main/steam-process/list-linux';
import {
  classifyMacProcess,
  listMacSteam,
  parsePsOutput,
} from '@/main/steam-process/list-macos';
import {
  parseTasklistCsv,
  parseWin32ProcessJson,
} from '@/main/steam-process/list-windows';
import {
  parseEnvSteamGameId,
  parseReaperAppId,
  parseRunningAppId,
} from '@/main/steam-process/running-game';

const hostExec = vi.hoisted(() => ({ outputs: new Map<string, string>() }));

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));
vi.mock('@/main/utils/host-exec', () => ({
  isFlatpak: () => false,
  execFileOnHost: (command: string, args: string[]) => {
    const stdout = hostExec.outputs.get(`${command} ${args[0]}`);
    return stdout === undefined
      ? Promise.reject(Object.assign(new Error('no match'), { code: 1 }))
      : Promise.resolve({ stdout, stderr: '' });
  },
}));

const MAC_STEAM =
  '/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS';
const MAC_HELPER = `/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper`;

describe('parseTasklistCsv', () => {
  it('reads pids from quoted CSV rows', () => {
    const stdout = [
      '"steam.exe","1234","Console","1","120,404 K"',
      '"steam.exe","5678","Console","1","1,024 K"',
      '',
    ].join('\r\n');
    expect(parseTasklistCsv(stdout, 'steam.exe')).toEqual([1234, 5678]);
  });

  it('matches the image name case-insensitively and exactly', () => {
    const stdout = [
      '"Steam.exe","10","Console","1","1 K"',
      '"steamwebhelper.exe","11","Console","1","1 K"',
    ].join('\n');
    expect(parseTasklistCsv(stdout, 'steam.exe')).toEqual([10]);
    expect(parseTasklistCsv(stdout, 'STEAMWEBHELPER.EXE')).toEqual([11]);
  });

  it('returns [] for no match and for localized "no tasks" text', () => {
    expect(parseTasklistCsv('', 'steam.exe')).toEqual([]);
    expect(
      parseTasklistCsv(
        'INFO: No tasks are running which match the specified criteria.\r\n',
        'steam.exe'
      )
    ).toEqual([]);
    expect(
      parseTasklistCsv(
        'ІНФОРМАЦІЯ: Немає запущених завдань, які відповідають указаним умовам.',
        'steam.exe'
      )
    ).toEqual([]);
  });
});

describe('parseWin32ProcessJson', () => {
  it('reads an array and keeps a null CommandLine as unreadable', () => {
    const stdout = JSON.stringify([
      {
        ProcessId: 100,
        ParentProcessId: 4,
        Name: 'steam.exe',
        CommandLine: '"C:\\Steam\\steam.exe"',
      },
      {
        ProcessId: 200,
        ParentProcessId: 100,
        Name: 'steamwebhelper.exe',
        CommandLine: null,
      },
    ]);
    expect(parseWin32ProcessJson(stdout)).toEqual([
      { pid: 100, ppid: 4, name: 'steam.exe', args: '"C:\\Steam\\steam.exe"' },
      { pid: 200, ppid: 100, name: 'steamwebhelper.exe', args: null },
    ]);
  });

  it('accepts a single object, a BOM and empty output', () => {
    const one = `\uFEFF${JSON.stringify({ ProcessId: 1, ParentProcessId: 0, Name: 'steam.exe', CommandLine: 'x' })}`;
    expect(parseWin32ProcessJson(one)).toHaveLength(1);
    expect(parseWin32ProcessJson('')).toEqual([]);
    expect(parseWin32ProcessJson('[]')).toEqual([]);
    expect(parseWin32ProcessJson('not json')).toEqual([]);
  });
});

describe('parsePsOutput', () => {
  it('splits pid, ppid and args with spaces in paths', () => {
    const stdout = [
      ` 2749     1 ${MAC_STEAM}/ipcserver`,
      `38080     1 ${MAC_STEAM}/steam_osx`,
      `38135 38080 ${MAC_HELPER} -nocrashdialog -lang=uk_UA`,
      '',
      'garbage line',
    ].join('\n');
    expect(parsePsOutput(stdout)).toEqual([
      { pid: 2749, ppid: 1, args: `${MAC_STEAM}/ipcserver` },
      { pid: 38080, ppid: 1, args: `${MAC_STEAM}/steam_osx` },
      { pid: 38135, ppid: 38080, args: `${MAC_HELPER} -nocrashdialog -lang=uk_UA` },
    ]);
  });

  it('returns [] for empty output', () => {
    expect(parsePsOutput('')).toEqual([]);
  });
});

describe('classifyMacProcess', () => {
  it('recognises steam_osx', () => {
    expect(classifyMacProcess(`${MAC_STEAM}/steam_osx`)).toBe('steam');
    expect(
      classifyMacProcess('/Applications/Steam.app/Contents/MacOS/steam_osx -foo')
    ).toBe('steam');
  });

  it('recognises Steam Helper even though its args mention steam_osx', () => {
    expect(
      classifyMacProcess(
        `${MAC_HELPER} -nocrashdialog -steampath=${MAC_STEAM}/steam_osx -launcher=0`
      )
    ).toBe('webhelper');
    expect(classifyMacProcess(`${MAC_HELPER} --type=renderer`)).toBe('webhelper');
  });

  it('ignores other Steam binaries', () => {
    expect(classifyMacProcess(`${MAC_STEAM}/ipcserver`)).toBe('other');
    expect(classifyMacProcess('/usr/bin/some_steam_osx_tool')).toBe('other');
  });

  it('ignores the Millennium launcher and its probe child', () => {
    expect(
      classifyMacProcess(
        '/Users/u/Applications/Steam Millennium.app/Contents/MacOS/steam_osx'
      )
    ).toBe('other');
    expect(
      classifyMacProcess(
        '/Users/u/Library/Application Support/Millennium/runtime/v3.5.0/steam_osx'
      )
    ).toBe('other');
    expect(classifyMacProcess(`${MAC_STEAM}/steam_osx -devtools-port 60519`)).toBe(
      'steam'
    );
  });
});

describe('listMacSteam', () => {
  it("counts steam_osx by executable and leaves out Millennium's launcher", async () => {
    const launcher =
      '/Users/u/Applications/Steam Millennium.app/Contents/MacOS/steam_osx';
    hostExec.outputs.set('pgrep -x', '100\n200\n');
    hostExec.outputs.set('ps -o', ` 100 ${launcher}\n 200 ${MAC_STEAM}/steam_osx\n`);
    hostExec.outputs.set(
      'ps -axww',
      [
        `  100     1 ${launcher}`,
        `  200   100 ${MAC_STEAM}/steam_osx -devtools-port 60519`,
        `  300   200 ${MAC_HELPER} -nocrashdialog`,
        `  400   200 ${MAC_HELPER} --type=crashpad-handler`,
      ].join('\n')
    );
    expect(await listMacSteam()).toEqual({
      steam: [
        { pid: 200, ppid: 100, args: `${MAC_STEAM}/steam_osx -devtools-port 60519` },
      ],
      webhelpers: [{ pid: 300, ppid: 200, args: `${MAC_HELPER} -nocrashdialog` }],
    });

    hostExec.outputs.clear();
    expect(await listMacSteam()).toEqual({ steam: [], webhelpers: [] });
  });
});

describe('parseLinuxPsOutput', () => {
  it('splits pid, ppid, comm and the full command line', () => {
    const stdout = [
      ' 2001     1 steam           /home/u/.local/share/Steam/ubuntu12_32/steam -srt-logger-opened',
      ' 2002  2001 steamwebhelper  /home/u/.local/share/Steam/ubuntu12_64/steamwebhelper --type=renderer',
      ' 2003  2001 reaper          /home/u/.local/share/Steam/ubuntu12_32/reaper SteamLaunch AppId=620 -- x',
      ' 2004     1 kworker/0:1',
      'garbage line',
    ].join('\n');
    expect(parseLinuxPsOutput(stdout)).toEqual([
      {
        pid: 2001,
        ppid: 1,
        comm: 'steam',
        args: '/home/u/.local/share/Steam/ubuntu12_32/steam -srt-logger-opened',
      },
      {
        pid: 2002,
        ppid: 2001,
        comm: 'steamwebhelper',
        args: '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper --type=renderer',
      },
      {
        pid: 2003,
        ppid: 2001,
        comm: 'reaper',
        args: '/home/u/.local/share/Steam/ubuntu12_32/reaper SteamLaunch AppId=620 -- x',
      },
      { pid: 2004, ppid: 1, comm: 'kworker/0:1', args: '' },
    ]);
  });
});

describe('parseRunningAppId', () => {
  const registry = (id: string) =>
    `"Registry"\n{\n\t"HKCU"\n\t{\n\t\t"Software"\n\t\t{\n\t\t\t"Valve"\n\t\t\t{\n\t\t\t\t"Steam"\n\t\t\t\t{\n\t\t\t\t\t"RunningAppID"\t\t"${id}"\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}\n`;

  it('returns the running Steam game', () => {
    expect(parseRunningAppId(registry('1552350'))).toBe(1552350);
  });

  it('ignores no game, non-Steam shortcuts and broken files', () => {
    expect(parseRunningAppId(registry('0'))).toBeNull();
    expect(parseRunningAppId(registry('3221225472'))).toBeNull();
    expect(parseRunningAppId('"Registry" { "HKCU" { } }')).toBeNull();
    expect(parseRunningAppId('not vdf {')).toBeNull();
  });
});

describe('parseReaperAppId', () => {
  const steam = '/home/deck/.local/share/Steam';

  it('reads the game a Linux Steam reaper runs', () => {
    const args = [
      `${steam}/ubuntu12_32/reaper`,
      'SteamLaunch',
      'AppId=1552350',
      '--',
      `${steam}/steamapps/common/SteamLinuxRuntime_soldier/_v2-entry-point`,
      '--verb=waitforexitandrun',
      '--',
      `${steam}/steamapps/common/The Jackbox Party Pack 8/Launcher.sh`,
    ].join(' ');
    expect(parseReaperAppId(args)).toBe(1552350);
    expect(
      parseReaperAppId('/home/u/My Games/Steam/ubuntu12_32/reaper SteamLaunch AppId=620')
    ).toBe(620);
  });

  it('ignores non-Steam shortcuts and AppId in the game arguments', () => {
    expect(
      parseReaperAppId(`${steam}/ubuntu12_32/reaper SteamLaunch AppId=3221225472 -- x`)
    ).toBeNull();
    expect(
      parseReaperAppId(`${steam}/ubuntu12_32/reaper -- /bin/game SteamLaunch AppId=10`)
    ).toBeNull();
    expect(parseReaperAppId('')).toBeNull();
  });
});

describe('parseEnvSteamGameId', () => {
  const game =
    '/bin/bash /Users/u/Library/Application Support/Steam/steamapps/common/Stardew Valley/Contents/MacOS/StardewValley SteamClientLaunch=1 SteamGameId=413150 SteamAppId=413150 HOME=/Users/u';

  it('reads the game id macOS Steam hands down to a game process', () => {
    const helper =
      '/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper -steampid=10493 HOME=/Users/u';
    expect(parseEnvSteamGameId(`${helper}\n${game}\n`)).toBe(413150);
  });

  it('ignores shortcuts, lookalike keys and an idle Steam', () => {
    expect(parseEnvSteamGameId('/bin/game SteamGameId=3221225472')).toBeNull();
    expect(parseEnvSteamGameId('/bin/game NotSteamGameId=10 SteamGameId=x')).toBeNull();
    expect(
      parseEnvSteamGameId('/Applications/Steam.app/Contents/MacOS/steam_osx\n')
    ).toBeNull();
  });
});
