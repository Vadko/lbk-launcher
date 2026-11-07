import { describe, expect, it, vi } from 'vitest';
import { parseLinuxPsOutput, parseProcStatus } from '@/main/steam-process/list-linux';
import {
  classifyMacProcess,
  listMacSteam,
  parsePsOutput,
} from '@/main/steam-process/list-macos';
import {
  parseTasklistCsv,
  parseTasklistSession,
  parseWin32ProcessJson,
  win32ProcessScript,
} from '@/main/steam-process/list-windows';
import { parseEnvSteamGameId, parseReaperAppId } from '@/main/steam-process/running-game';

const hostExec = vi.hoisted(() => ({
  outputs: new Map<string, string>(),
  calls: [] as string[][],
}));

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));
vi.mock('@/main/utils/host-exec', () => ({
  isFlatpak: () => false,
  execFileOnHost: (command: string, args: string[]) => {
    hostExec.calls.push([command, ...args]);
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
  it('reads pids of the exact image name, case-insensitively', () => {
    const stdout = [
      '"Steam.exe","1234","Console","1","120,404 K"',
      '"steam.exe","5678","Console","1","1,024 K"',
      '"steamwebhelper.exe","11","Console","1","1 K"',
      '',
    ].join('\r\n');
    expect(parseTasklistCsv(stdout, 'steam.exe')).toEqual([1234, 5678]);
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
        'INFORMATION: Es werden keine Tasks mit den angegebenen Kriterien ausgeführt.',
        'steam.exe'
      )
    ).toEqual([]);
  });
});

describe('parseTasklistSession', () => {
  const stdout = [
    '"steam.exe","1234","Console","1","120,404 K"',
    '"LBK Launcher.exe","4321","","2","88,000 K"',
    '',
  ].join('\r\n');

  it.each([
    ['our own row', stdout, 4321, 2],
    ['another process only', stdout, 999, null],
    ['the localized "no tasks" text', 'INFO: No tasks are running.\r\n', 4321, null],
  ])('reads %s', (_label, text, pid, session) => {
    expect(parseTasklistSession(text, pid)).toBe(session);
  });
});

describe('win32ProcessScript', () => {
  it.each([
    ['our session only', 3, "OR Name='steamwebhelper.exe') AND SessionId=3\""],
    ['every session when ours is unknown', null, "OR Name='steamwebhelper.exe')\""],
  ])('lists %s', (_label, session, filter) => {
    expect(win32ProcessScript(session)).toContain(filter);
  });
});

describe('parseWin32ProcessJson', () => {
  it('reads an array or a single object and keeps a null CommandLine as unreadable', () => {
    const steam = {
      ProcessId: 100,
      ParentProcessId: 4,
      Name: 'steam.exe',
      CommandLine: 'x',
    };
    const helper = { ...steam, ProcessId: 200, ParentProcessId: 100, CommandLine: null };
    expect(parseWin32ProcessJson(JSON.stringify([steam, helper]))).toEqual([
      { pid: 100, ppid: 4, name: 'steam.exe', args: 'x' },
      { pid: 200, ppid: 100, name: 'steam.exe', args: null },
    ]);
    expect(parseWin32ProcessJson(`\uFEFF${JSON.stringify(steam)}`)).toHaveLength(1);
    expect(parseWin32ProcessJson('')).toEqual([]);
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
    expect(parsePsOutput('')).toEqual([]);
  });
});

describe('classifyMacProcess', () => {
  it.each([
    [`${MAC_STEAM}/steam_osx`, 'steam'],
    ['/Applications/Steam.app/Contents/MacOS/steam_osx -foo', 'steam'],
    [`${MAC_STEAM}/steam_osx -devtools-port 60519`, 'steam'],
    [
      `${MAC_HELPER} -nocrashdialog -steampath=${MAC_STEAM}/steam_osx -launcher=0`,
      'webhelper',
    ],
    [`${MAC_HELPER} --type=renderer`, 'webhelper'],
    [`${MAC_STEAM}/ipcserver`, 'other'],
    ['/usr/bin/some_steam_osx_tool', 'other'],
    ['/Users/u/Applications/Steam Millennium.app/Contents/MacOS/steam_osx', 'other'],
    ['/Users/u/Library/Application Support/Millennium/runtime/v3.5.0/steam_osx', 'other'],
  ])('classifies %s as %s', (args, kind) => {
    expect(classifyMacProcess(args)).toBe(kind);
  });
});

describe('listMacSteam', () => {
  it("counts this user's steam_osx by executable and leaves out Millennium's launcher", async () => {
    const launcher =
      '/Users/u/Applications/Steam Millennium.app/Contents/MacOS/steam_osx';
    hostExec.calls.length = 0;
    hostExec.outputs.set('pgrep -x', '100\n200\n');
    hostExec.outputs.set('ps -o', ` 100 ${launcher}\n 200 ${MAC_STEAM}/steam_osx\n`);
    hostExec.outputs.set(
      'ps -xww',
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
    const uid = String(process.getuid?.());
    expect(hostExec.calls).toContainEqual(['pgrep', '-x', '-u', uid, 'steam_osx']);
    expect(hostExec.calls).toContainEqual([
      'ps',
      '-xww',
      '-U',
      uid,
      '-o',
      'pid=,ppid=,args=',
    ]);
  });

  it('reports no Steam when pgrep matches nothing, and a failed listing when ps fails', async () => {
    hostExec.outputs.clear();
    hostExec.outputs.set('ps -xww', `  300     1 ${MAC_HELPER} --type=crashpad-handler`);
    expect(await listMacSteam()).toEqual({ steam: [], webhelpers: [] });

    hostExec.outputs.clear();
    expect(await listMacSteam()).toBeNull();
  });
});

describe('parseLinuxPsOutput', () => {
  const stdout = [
    ' 2001     1  1000 steam           /home/u/Steam/steam -srt-logger-opened',
    ' 2002     1  1001 steam           /home/b/Steam/steam',
    ' 2004     1     0 kworker/0:1',
    'garbage line',
  ].join('\n');
  const own = {
    pid: 2001,
    ppid: 1,
    comm: 'steam',
    args: '/home/u/Steam/steam -srt-logger-opened',
  };

  it("splits pid, ppid, comm and the full command line, keeping this user's rows", () => {
    expect(parseLinuxPsOutput(stdout, 1000)).toEqual([own]);
  });

  it('keeps every row when the uid is unknown', () => {
    expect(parseLinuxPsOutput(stdout, null)).toEqual([
      own,
      { pid: 2002, ppid: 1, comm: 'steam', args: '/home/b/Steam/steam' },
      { pid: 2004, ppid: 1, comm: 'kworker/0:1', args: '' },
    ]);
  });
});

describe('parseProcStatus', () => {
  it.each([
    [
      'a status file',
      'Name:\tsteam\nPPid:\t1742\nUid:\t1000\t1000\t1000\t1000\n',
      { ppid: 1742, uid: 1000 },
    ],
    [
      'the real uid of a setuid process',
      'PPid:\t1\nUid:\t1000\t0\t0\t0\n',
      { ppid: 1, uid: 1000 },
    ],
    ['an unreadable status', '', { ppid: 0, uid: null }],
  ])('reads %s', (_label, status, parsed) => {
    expect(parseProcStatus(status)).toEqual(parsed);
  });
});

describe('parseReaperAppId', () => {
  const steam = '/home/deck/.local/share/Steam';
  const proton = [
    `${steam}/ubuntu12_32/reaper`,
    'SteamLaunch',
    'AppId=1552350',
    '--',
    `${steam}/steamapps/common/SteamLinuxRuntime_soldier/_v2-entry-point`,
    '--verb=waitforexitandrun',
    '--',
    `${steam}/steamapps/common/The Jackbox Party Pack 8/Launcher.sh`,
  ].join(' ');

  it.each([
    ['a game under the runtime', proton, 1552350],
    [
      'a Steam path with spaces',
      '/home/u/My Games/Steam/ubuntu12_32/reaper SteamLaunch AppId=620',
      620,
    ],
    [
      'a non-Steam shortcut',
      `${steam}/ubuntu12_32/reaper SteamLaunch AppId=3221225472 -- x`,
      null,
    ],
    [
      'AppId in the game arguments',
      `${steam}/ubuntu12_32/reaper -- /bin/game SteamLaunch AppId=10`,
      null,
    ],
    ['an empty command line', '', null],
  ])('reads %s', (_label, args, appId) => {
    expect(parseReaperAppId(args)).toBe(appId);
  });
});

describe('parseEnvSteamGameId', () => {
  const helper =
    '/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper -steampid=10493 HOME=/Users/u';
  const game =
    '/bin/bash /Users/u/Library/Application Support/Steam/steamapps/common/Stardew Valley/Contents/MacOS/StardewValley SteamClientLaunch=1 SteamGameId=413150 SteamAppId=413150 HOME=/Users/u';

  it.each([
    ['the id Steam hands down to a game', `${helper}\n${game}\n`, 413150],
    ['a shortcut', '/bin/game SteamGameId=3221225472', null],
    ['lookalike keys', '/bin/game NotSteamGameId=10 SteamGameId=x', null],
    ['an idle Steam', '/Applications/Steam.app/Contents/MacOS/steam_osx\n', null],
  ])('reads %s', (_label, text, appId) => {
    expect(parseEnvSteamGameId(text)).toBe(appId);
  });
});
