import { describe, expect, it, vi } from 'vitest';
import {
  parseDevtoolsPortArg,
  parseWebhelperDebugArgs,
  parseWebhelperLog,
} from '@/main/utils/steam-cef-discovery';

vi.mock('@/main/game-detector/steam', () => ({ getSteamPath: () => null }));

const MAC_STEAM =
  '/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS';
const MAC_HELPER = `/Users/u/Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/Frameworks/Steam Helper.app/Contents/MacOS/Steam Helper`;

describe('parseWebhelperDebugArgs', () => {
  it.each([
    [
      'a NUL-separated Linux cmdline',
      [
        '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper',
        '-lang=en_US',
        '--remote-debugging-port=8080',
        '',
      ].join('\0'),
      { isMain: true, port: 8080, pipe: false, millenniumFlags: false },
    ],
    [
      'a space-joined (title-rewritten) cmdline',
      '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper -nocrashdialog --remote-debugging-port=9222 --enable-smooth-scrolling',
      { isMain: true, port: 9222, pipe: false, millenniumFlags: false },
    ],
    [
      'a --type= child as not main',
      `${MAC_HELPER} --type=renderer --enable-chrome-runtime --remote-debugging-port=8080 --lang=uk`,
      { isMain: false, port: 8080, pipe: false, millenniumFlags: false },
    ],
    [
      'the Windows Millennium pipe flags',
      '"C:\\Program Files (x86)\\Steam\\bin\\cef\\cef.win7x64\\steamwebhelper.exe" -lang=en_US --remote-debugging-pipe --remote-debugging-io-pipes=1234,5678 --millennium-loopback-ipc-handles=1,2',
      { isMain: true, port: null, pipe: true, millenniumFlags: true },
    ],
    [
      'a bare --remote-debugging-pipe at the end',
      'steamwebhelper --remote-debugging-pipe',
      { isMain: true, port: null, pipe: true, millenniumFlags: true },
    ],
    [
      'a cmdline with no debug flags',
      `${MAC_HELPER} -nocrashdialog -lang=uk_UA`,
      { isMain: true, port: null, pipe: false, millenniumFlags: false },
    ],
  ])('reads %s', (_label, cmdline, expected) => {
    expect(parseWebhelperDebugArgs(cmdline)).toEqual(expected);
  });

  it.each([
    [
      'keeps the digits of a port with a trailing comma',
      '--remote-debugging-port=8080,',
      8080,
    ],
    ['rejects port 0', '--remote-debugging-port=0', null],
    ['rejects an out-of-range port', '--remote-debugging-port=70000', null],
    ['ignores a longer flag name', '--x-remote-debugging-port=8080', null],
  ])('%s', (_label, flag, port) => {
    expect(parseWebhelperDebugArgs(`steamwebhelper ${flag}`).port).toBe(port);
  });

  it.each([
    [
      'the Linux env wrapper with its fds',
      [
        '/usr/bin/env',
        'PRESSURE_VESSEL_PREFIX=/tmp/millennium-pv',
        '/home/u/.local/share/Steam/ubuntu12_64/steamwebhelper.sh',
        '--remote-debugging-pipe',
        '--millennium-loopback-ipc-fds=5,6',
      ].join('\0'),
      true,
    ],
    [
      'the PRESSURE_VESSEL_PREFIX wrapper on its own',
      '/usr/bin/env PRESSURE_VESSEL_PREFIX=/x steamwebhelper',
      false,
    ],
  ])('detects Millennium from %s', (_label, cmdline, pipe) => {
    const args = parseWebhelperDebugArgs(cmdline);
    expect(args.millenniumFlags).toBe(true);
    expect(args.pipe).toBe(pipe);
  });
});

describe('parseDevtoolsPortArg', () => {
  it.each([
    [`${MAC_STEAM}/steam_osx -cef-enable-debugging -devtools-port 41234`, 41234],
    ['steam_osx -devtools-port=9333', 9333],
    [['steam_osx', '-devtools-port', '9444'].join('\0'), 9444],
    ['steam_osx --devtools-port 9333', null],
    ['steam_osx -devtools-port', null],
    ['steam_osx', null],
  ])('reads %j as %s', (args, port) => {
    expect(parseDevtoolsPortArg(args)).toBe(port);
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
