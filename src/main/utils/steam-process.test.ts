import { describe, expect, it, vi } from 'vitest';
import {
  classifyLinuxProcess,
  classifyMacProcess,
  parseDevtoolsPortArg,
  parsePsOutput,
  parseReaperAppId,
  parseRunningAppId,
  parseTasklistCsv,
  parseWebhelperDebugArgs,
  parseWebhelperLog,
  parseWin32ProcessJson,
} from '@/main/utils/steam-process';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const MAC_STEAM =
  '/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS';
const MAC_HELPER = `/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper`;

describe('parseWebhelperDebugArgs', () => {
  it('reads a NUL-separated Linux cmdline', () => {
    const cmdline = [
      '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper',
      '-lang=en_US',
      '--remote-debugging-port=8080',
      '',
    ].join('\0');
    expect(parseWebhelperDebugArgs(cmdline)).toEqual({
      isMain: true,
      port: 8080,
      pipe: false,
      millenniumFlags: false,
    });
  });

  it('reads a space-joined (title-rewritten) cmdline', () => {
    const args = parseWebhelperDebugArgs(
      '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper -nocrashdialog --remote-debugging-port=9222 --enable-smooth-scrolling'
    );
    expect(args.port).toBe(9222);
    expect(args.isMain).toBe(true);
  });

  it('marks --type= children as not main', () => {
    const args = parseWebhelperDebugArgs(
      `${MAC_HELPER} --type=renderer --enable-chrome-runtime --remote-debugging-port=8080 --lang=uk`
    );
    expect(args.isMain).toBe(false);
    expect(args.port).toBe(8080);
  });

  it('keeps only the digits of a port with a trailing comma', () => {
    expect(
      parseWebhelperDebugArgs('steamwebhelper --remote-debugging-port=8080,').port
    ).toBe(8080);
  });

  it('rejects port 0 and out-of-range ports', () => {
    expect(
      parseWebhelperDebugArgs('steamwebhelper --remote-debugging-port=0').port
    ).toBeNull();
    expect(
      parseWebhelperDebugArgs('steamwebhelper --remote-debugging-port=70000').port
    ).toBeNull();
  });

  it('does not take the port from a longer flag name', () => {
    expect(
      parseWebhelperDebugArgs('steamwebhelper --x-remote-debugging-port=8080').port
    ).toBeNull();
  });

  it('detects the Windows Millennium pipe flags', () => {
    const args = parseWebhelperDebugArgs(
      '"C:\\Program Files (x86)\\Steam\\bin\\cef\\cef.win7x64\\steamwebhelper.exe" -lang=en_US --remote-debugging-pipe --remote-debugging-io-pipes=1234,5678 --millennium-loopback-ipc-handles=1,2'
    );
    expect(args).toEqual({ isMain: true, port: null, pipe: true, millenniumFlags: true });
  });

  it('treats a bare --remote-debugging-pipe at the end as a pipe', () => {
    expect(parseWebhelperDebugArgs('steamwebhelper --remote-debugging-pipe').pipe).toBe(
      true
    );
  });

  it('detects the Millennium Linux env wrapper', () => {
    const args = parseWebhelperDebugArgs(
      [
        '/usr/bin/env',
        'PRESSURE_VESSEL_PREFIX=/tmp/millennium-pv',
        '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper.sh',
        '--remote-debugging-pipe',
        '--millennium-loopback-ipc-fds=5,6',
      ].join('\0')
    );
    expect(args.millenniumFlags).toBe(true);
    expect(args.pipe).toBe(true);
  });

  it('flags the PRESSURE_VESSEL_PREFIX wrapper on its own', () => {
    expect(
      parseWebhelperDebugArgs('/usr/bin/env PRESSURE_VESSEL_PREFIX=/x steamwebhelper')
        .millenniumFlags
    ).toBe(true);
  });

  it('reports nothing for a cmdline with no debug flags', () => {
    expect(parseWebhelperDebugArgs(`${MAC_HELPER} -nocrashdialog -lang=uk_UA`)).toEqual({
      isMain: true,
      port: null,
      pipe: false,
      millenniumFlags: false,
    });
  });
});

describe('parseDevtoolsPortArg', () => {
  it('reads "-devtools-port N"', () => {
    expect(
      parseDevtoolsPortArg(
        `${MAC_STEAM}/steam_osx -cef-enable-debugging -devtools-port 41234`
      )
    ).toBe(41234);
  });

  it('reads "-devtools-port=N" and NUL-separated args', () => {
    expect(parseDevtoolsPortArg('steam_osx -devtools-port=9333')).toBe(9333);
    expect(parseDevtoolsPortArg(['steam_osx', '-devtools-port', '9444'].join('\0'))).toBe(
      9444
    );
  });

  it('ignores the double-dash Chromium flag and missing values', () => {
    expect(parseDevtoolsPortArg('steam_osx --devtools-port 9333')).toBeNull();
    expect(parseDevtoolsPortArg('steam_osx -devtools-port')).toBeNull();
    expect(parseDevtoolsPortArg('steam_osx')).toBeNull();
  });
});

describe('parseWebhelperLog', () => {
  const line = (pid: number, cmd: string): string =>
    `[2026-10-09 21:35:17] Startup - webhelper launched pid: ${pid} commandline: ${cmd}`;

  it('picks the last launch line and its pid', () => {
    const text = [
      '[2026-08-17 01:03:29] Client version: no bootstrapper found',
      line(10193, `${MAC_HELPER} -lang=en_US --remote-debugging-port=9000`),
      '[2026-08-17 01:03:30] some other line',
      line(
        38135,
        `${MAC_HELPER} -lang=uk_UA --remote-debugging-port=8080 --enable-smooth-scrolling`
      ),
      '[2026-10-09 22:26:09] notificationtoasts: WasHidden 1',
    ].join('\r\n');
    const entry = parseWebhelperLog(text);
    expect(entry?.pid).toBe(38135);
    expect(entry && parseWebhelperDebugArgs(entry.args).port).toBe(8080);
  });

  it('returns null when there is no launch line', () => {
    expect(parseWebhelperLog('[2026-10-09] nothing here\n')).toBeNull();
    expect(parseWebhelperLog('')).toBeNull();
  });

  it('drops the cut last token of a 1023-char message', () => {
    const prefix = 'Startup - webhelper launched pid: 42 commandline: ';
    const head = `${MAC_HELPER} --remote-allow-origins=* `;
    const filler = 'x'.repeat(
      1023 - prefix.length - head.length - '--remote-debugging-port=80'.length - 1
    );
    const message = `${prefix}${head}${filler} --remote-debugging-port=80`;
    expect(message.length).toBe(1023);

    const entry = parseWebhelperLog(`[2026-10-09 21:35:17] ${message}\r\n[next] line`);
    expect(entry?.pid).toBe(42);
    expect(entry?.args.endsWith(filler)).toBe(true);
    expect(entry && parseWebhelperDebugArgs(entry.args).port).toBeNull();
  });

  it('keeps the last token of a short, complete message', () => {
    const entry = parseWebhelperLog(
      line(7, 'steamwebhelper --remote-debugging-port=8080')
    );
    expect(entry && parseWebhelperDebugArgs(entry.args).port).toBe(8080);
  });

  it('keeps the port of a real truncated macOS line', () => {
    const cmd = `${MAC_HELPER} -nocrashdialog -lang=uk_UA -cachedir=/Users/u/Library/Application Support/Steam/config/htmlcache -steampid=38080 -buildid=1788652215 -steamid=0 -logdir=/Users/u/Library/Application Support/Steam/logs -uimode=7 -startcount=0 -steamuniverse=Public -realm=Global -clientui=${MAC_STEAM}/clientui -steampath=${MAC_STEAM}/steam_osx -launcher=0 -delaypageload --valve-initial-threadpool-size=10 --valve-enable-site-isolation --remote-allow-origins=* --remote-debugging-address=127.0.0.1 --remote-debugging-port=8080 --enable-smooth-scrolling --log-file=/Users/u/Library/Application Support/Steam/logs/cef_log.txt --disable-quick-menu --disable-component-update --gaia-url=http://disabled.invalid --enable-features=PlatformHEVCDecoderSupport`;
    const message = `Startup - webhelper launched pid: 38135 commandline: ${cmd}`.slice(
      0,
      1023
    );
    const entry = parseWebhelperLog(`[2026-10-09 21:35:17] ${message}\r\n`);
    expect(entry?.pid).toBe(38135);
    expect(entry && parseWebhelperDebugArgs(entry.args).port).toBe(8080);
  });
});

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

describe('classifyLinuxProcess', () => {
  it('recognises steam and steamwebhelper by executable name', () => {
    expect(
      classifyLinuxProcess(
        '/home/u/.local/share/Steam/ubuntu12_32/steam -srt-logger-opened'
      )
    ).toBe('steam');
    expect(
      classifyLinuxProcess(
        '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper --type=renderer'
      )
    ).toBe('webhelper');
  });

  it('ignores wrappers and look-alikes', () => {
    expect(classifyLinuxProcess('/bin/bash /home/u/.local/share/Steam/steam.sh')).toBe(
      'other'
    );
    expect(
      classifyLinuxProcess('/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper.sh')
    ).toBe('other');
    expect(classifyLinuxProcess('')).toBe('other');
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
