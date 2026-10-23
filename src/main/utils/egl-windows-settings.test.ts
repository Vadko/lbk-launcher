import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AtomicWriteModule from './atomic-write';
import {
  flushEglLaunchArgs,
  setEglWindowsLaunchArgs,
  startPendingEglLaunchArgs,
  withEglLaunchArgs,
} from './egl-windows-settings';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  writeFileAtomic: vi.fn(),
  store: new Map<string, unknown>(),
}));

vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
vi.mock('./atomic-write', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicWriteModule>();
  mocks.writeFileAtomic.mockImplementation(actual.writeFileAtomic);
  return { writeFileAtomic: mocks.writeFileAtomic };
});
vi.mock('./store-storage', () => ({
  deleteStoreValue: (key: string) => mocks.store.delete(key),
  readStoreValue: (key: string) => mocks.store.get(key),
  writeStoreValue: (key: string, value: unknown) => mocks.store.set(key, value),
}));

const APP_ID = 'd6407c9e6fd54cb492b8c6635480d792:1b5a2c0e3c3f4c2e8c4a1e1f0e8f7a6b:Pit';
const ACCOUNT = '[0123456789abcdef0123456789abcdef_Settings]';
const OTHER_ACCOUNT = '[fedcba9876543210fedcba9876543210_Settings]';
const REMEMBER_ME = '[RememberMe]\r\nEnable=True\r\nData=c2VjcmV0LXRva2Vu';

function ini(...lines: string[]): string {
  return lines.join('\r\n');
}

function eglRunning(running: boolean) {
  const stdout = running
    ? '"EpicGamesLauncher.exe","4242","Console","1","123,456 K"\r\n'
    : 'INFO: No tasks are running which match the specified criteria.\r\n';
  mocks.execFile.mockImplementation((_file, _args, _options, callback) =>
    callback(null, { stdout, stderr: '' })
  );
}

describe('withEglLaunchArgs', () => {
  it('adds the args to each account section and keeps everything else byte for byte', () => {
    const before = ini(
      REMEMBER_ME,
      '',
      ACCOUNT,
      'ShowGameSaveWarning=False',
      '',
      OTHER_ACCOUNT,
      'Theme=Dark',
      ''
    );

    expect(withEglLaunchArgs(before, APP_ID, '-load-mods "Two Words"')).toBe(
      ini(
        REMEMBER_ME,
        '',
        ACCOUNT,
        'ShowGameSaveWarning=False',
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands=-load-mods "Two Words"`,
        '',
        OTHER_ACCOUNT,
        'Theme=Dark',
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands=-load-mods "Two Words"`,
        ''
      )
    );
  });

  it('merges into the player args once, and replaces args the player switched off', () => {
    const enabled = ini(
      ACCOUNT,
      `${APP_ID}_AdditionalCommandsEnabled=True`,
      `${APP_ID}_AdditionalCommands=-windowed`
    );
    const merged = withEglLaunchArgs(enabled, APP_ID, '-load-mods') ?? '';
    expect(merged).toBe(
      ini(
        ACCOUNT,
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands=-windowed -load-mods`
      )
    );
    expect(withEglLaunchArgs(merged, APP_ID, '-load-mods')).toBe(merged);

    const disabled = ini(
      ACCOUNT,
      `${APP_ID}_AdditionalCommandsEnabled=False`,
      `${APP_ID}_AdditionalCommands=-old`
    );
    expect(withEglLaunchArgs(disabled, APP_ID, '-load-mods')).toBe(
      ini(
        ACCOUNT,
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands=-load-mods`
      )
    );
  });

  it('leaves other games alone and keeps LF files LF', () => {
    const other = 'ns:item:Other_AdditionalCommands=-x';
    expect(withEglLaunchArgs([ACCOUNT, other].join('\n'), APP_ID, '-a')).toBe(
      [
        ACCOUNT,
        other,
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands=-a`,
      ].join('\n')
    );
  });

  it('quotes values UE would cut, and reads its quoted values back', () => {
    const quoted =
      withEglLaunchArgs(ini(ACCOUNT, ''), APP_ID, '"C:\\My Game\\Mods" -load') ?? '';
    expect(quoted).toBe(
      ini(
        ACCOUNT,
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands="\\"C:\\\\My Game\\\\Mods\\" -load"`,
        ''
      )
    );
    expect(withEglLaunchArgs(quoted, APP_ID, '"C:\\My Game\\Mods" -load')).toBe(quoted);

    const commented = ini(
      ACCOUNT,
      `${APP_ID}_AdditionalCommandsEnabled=True`,
      `${APP_ID}_AdditionalCommands="-x //y"`
    );
    expect(withEglLaunchArgs(commented, APP_ID, '-a')).toBe(
      ini(
        ACCOUNT,
        `${APP_ID}_AdditionalCommandsEnabled=True`,
        `${APP_ID}_AdditionalCommands="-x //y -a"`
      )
    );
  });

  it.each([
    ['a trailing backslash', '-dir=C:\\Mods\\'],
    ['braces', '-x={a}'],
    ['a line break', '-a\n-b'],
  ])('keeps a value with %s on one quoted line, and reads it back', (_, args) => {
    const once = withEglLaunchArgs(ini(ACCOUNT, ''), APP_ID, args) ?? '';
    const lines = once.split('\r\n');

    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(new RegExp(`^${APP_ID}_AdditionalCommands="`));
    expect(withEglLaunchArgs(once, APP_ID, args)).toBe(once);
  });

  it('gives up on a file with no signed-in account', () => {
    expect(
      withEglLaunchArgs(ini(REMEMBER_ME, '[Launcher]', 'X=1'), APP_ID, '-a')
    ).toBeNull();
  });
});

describe('setEglWindowsLaunchArgs', () => {
  const dirs: string[] = [];
  const PENDING_KEY = 'pending-egl-launch-args';
  const WRITTEN = ini(
    REMEMBER_ME,
    ACCOUNT,
    'X=1',
    `${APP_ID}_AdditionalCommandsEnabled=True`,
    `${APP_ID}_AdditionalCommands=-load-mods`
  );

  function setUpSettings(content: string | Buffer): string {
    const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'lbk-egl-win-'));
    dirs.push(localAppData);
    vi.stubEnv('LOCALAPPDATA', localAppData);
    const file = path.join(
      localAppData,
      'EpicGamesLauncher/Saved/Config/WindowsEditor/GameUserSettings.ini'
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(async () => {
    mocks.store.clear();
    eglRunning(false);
    await vi.advanceTimersByTimeAsync(15000);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes right away while EGL is not running', async () => {
    const file = setUpSettings(ini(REMEMBER_ME, ACCOUNT, 'X=1'));
    eglRunning(false);

    await expect(setEglWindowsLaunchArgs(APP_ID, '-load-mods')).resolves.toBe('written');

    expect(fs.readFileSync(file, 'utf8')).toBe(WRITTEN);
    expect(mocks.store.has(PENDING_KEY)).toBe(false);
  });

  it('keeps the BOM and the UTF-16 encoding UE saved the file in', async () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const utf8 = setUpSettings(
      Buffer.concat([bom, Buffer.from(ini(ACCOUNT, ''), 'utf8')])
    );
    eglRunning(false);
    await setEglWindowsLaunchArgs(APP_ID, '-a');
    expect(fs.readFileSync(utf8)).toEqual(
      Buffer.concat([
        bom,
        Buffer.from(
          ini(
            ACCOUNT,
            `${APP_ID}_AdditionalCommandsEnabled=True`,
            `${APP_ID}_AdditionalCommands=-a`,
            ''
          ),
          'utf8'
        ),
      ])
    );

    const utf16Bom = Buffer.from([0xff, 0xfe]);
    // eslint-disable-next-line no-restricted-syntax -- a non-ASCII value is what makes UE save UTF-16
    const nonAscii = 'Path=C:\\Ігри';
    const utf16 = setUpSettings(
      Buffer.concat([utf16Bom, Buffer.from(ini(ACCOUNT, nonAscii), 'utf16le')])
    );
    await expect(setEglWindowsLaunchArgs(APP_ID, '-a')).resolves.toBe('written');
    expect(fs.readFileSync(utf16)).toEqual(
      Buffer.concat([
        utf16Bom,
        Buffer.from(
          ini(
            ACCOUNT,
            nonAscii,
            `${APP_ID}_AdditionalCommandsEnabled=True`,
            `${APP_ID}_AdditionalCommands=-a`
          ),
          'utf16le'
        ),
      ])
    );
  });

  it('waits for a running EGL to quit, then edits the file EGL left behind', async () => {
    const file = setUpSettings(ini(ACCOUNT, 'X=1'));
    eglRunning(true);

    await expect(setEglWindowsLaunchArgs(APP_ID, '-load-mods')).resolves.toBe('queued');
    expect(mocks.store.get(PENDING_KEY)).toEqual({ [APP_ID]: '-load-mods' });
    await vi.advanceTimersByTimeAsync(15000);
    expect(fs.readFileSync(file, 'utf8')).toBe(ini(ACCOUNT, 'X=1'));

    // EGL rewrites the file from memory as it exits, the fresh login token included
    fs.writeFileSync(file, ini(REMEMBER_ME, ACCOUNT, 'X=1'));
    eglRunning(false);
    await vi.advanceTimersByTimeAsync(15000);

    expect(fs.readFileSync(file, 'utf8')).toBe(WRITTEN);
    expect(mocks.store.has(PENDING_KEY)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a queued write the file refused', async () => {
    const file = setUpSettings(ini(REMEMBER_ME, ACCOUNT, 'X=1'));
    eglRunning(true);
    await setEglWindowsLaunchArgs(APP_ID, '-load-mods');

    eglRunning(false);
    mocks.writeFileAtomic.mockImplementationOnce(() => {
      throw new Error('EBUSY');
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(mocks.store.get(PENDING_KEY)).toEqual({ [APP_ID]: '-load-mods' });

    await vi.advanceTimersByTimeAsync(15000);
    expect(fs.readFileSync(file, 'utf8')).toBe(WRITTEN);
    expect(mocks.store.has(PENDING_KEY)).toBe(false);
  });

  it('picks up args queued before LBK restarted', async () => {
    const file = setUpSettings(ini(REMEMBER_ME, ACCOUNT, 'X=1'));
    mocks.store.set(PENDING_KEY, { [APP_ID]: '-load-mods' });
    eglRunning(false);

    startPendingEglLaunchArgs();
    await vi.advanceTimersByTimeAsync(0);

    expect(fs.readFileSync(file, 'utf8')).toBe(WRITTEN);
    expect(mocks.store.has(PENDING_KEY)).toBe(false);
  });

  it('drops an older queued value once a newer one is written directly', async () => {
    const file = setUpSettings(ini(REMEMBER_ME, ACCOUNT, 'X=1'));
    eglRunning(true);
    await setEglWindowsLaunchArgs(APP_ID, '-old');

    eglRunning(false);
    await setEglWindowsLaunchArgs(APP_ID, '-load-mods');
    await flushEglLaunchArgs();

    expect(fs.readFileSync(file, 'utf8')).toBe(WRITTEN);
  });

  it('treats a failed process check as a running EGL', async () => {
    setUpSettings(ini(ACCOUNT));
    mocks.execFile.mockImplementation((_file, _args, _options, callback) =>
      callback(new Error('tasklist failed'))
    );

    await expect(setEglWindowsLaunchArgs(APP_ID, '-a')).resolves.toBe('queued');
  });

  it('fails without a settings file or a signed-in account', async () => {
    eglRunning(false);
    vi.stubEnv('LOCALAPPDATA', path.join(os.tmpdir(), 'lbk-egl-missing'));
    await expect(setEglWindowsLaunchArgs(APP_ID, '-a')).resolves.toBe('failed');

    const file = setUpSettings(ini('[Launcher]', 'X=1'));
    await expect(setEglWindowsLaunchArgs(APP_ID, '-a')).resolves.toBe('failed');
    expect(fs.readFileSync(file, 'utf8')).toBe(ini('[Launcher]', 'X=1'));
  });
});
