import { beforeEach, describe, expect, it, vi } from 'vitest';

// The module reaches into Steam and the filesystem; the OS split and the
// no-fallback rule are decided long before any of that, so it is all stubbed.
vi.mock('@/main/game-detector/steam', () => ({ getLocalConfigPath: () => null }));
vi.mock('@/main/utils/cef-flag-file', () => ({
  isCefDebuggingEnabledInSettings: () => false,
}));
vi.mock('@/main/utils/steam-cef', () => ({
  evaluateInSharedJsContext: vi.fn(),
  isCefAvailable: () => false,
}));
vi.mock('@/main/utils/steam-launcher', () => ({ isSteamRunning: () => false }));
vi.mock('@/main/utils/platform', () => ({
  isWindows: vi.fn(() => false),
  isLinux: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
}));

const platform = await import('@/main/utils/platform');
const { needsGameDir, writeSteamLaunchOptions } = await import(
  '@/main/utils/steam-launch-options'
);

function runningOn(os: 'windows' | 'linux' | 'macos'): void {
  vi.mocked(platform.isWindows).mockReturnValue(os === 'windows');
  vi.mocked(platform.isLinux).mockReturnValue(os === 'linux');
  vi.mocked(platform.isMacOS).mockReturnValue(os === 'macos');
}

/** Only the fields this module reads. */
function game(options: {
  windows?: string | null;
  linux?: string | null;
  macos?: string | null;
}) {
  return {
    steam_app_id: 413150,
    steam_launch_options_windows: options.windows ?? null,
    steam_launch_options_linux: options.linux ?? null,
    steam_launch_options_macos: options.macos ?? null,
  };
}

/** `noop` with this reason means the OS had no value of its own to write. */
const NOTHING_FOR_THIS_OS = 'No launch options for current OS';

beforeEach(() => {
  runningOn('linux');
});

describe('per-OS value selection', () => {
  it('never falls back to the Linux value on macOS', async () => {
    // The whole point of the separate column: the Linux path is wrong on macOS
    // (the binary lives in Contents/MacOS), so applying it would break launching
    // while still looking like a success.
    runningOn('macos');
    const result = await writeSteamLaunchOptions({
      appId: 413150,
      windowsOptions: '"{GAME_DIR}\\loader.exe" %command%',
      linuxOptions: 'gamemoderun %command%',
      macosOptions: null,
      gamePath: '/games/sdv',
    });

    expect(result.mode).toBe('noop');
    expect(result.reason).toBe(NOTHING_FOR_THIS_OS);
  });

  it('uses the macOS value when it is set', async () => {
    runningOn('macos');
    const result = await writeSteamLaunchOptions({
      appId: 413150,
      windowsOptions: null,
      linuxOptions: null,
      macosOptions: '"{GAME_DIR}/Contents/MacOS/loader" %command%',
      gamePath: '/games/sdv',
    });

    // Got past the OS check and failed later, on the stubbed missing config.
    expect(result.mode).toBe('failed');
  });

  it('leaves the Linux value to Linux', async () => {
    runningOn('linux');
    const result = await writeSteamLaunchOptions({
      appId: 413150,
      windowsOptions: null,
      linuxOptions: 'gamemoderun %command%',
      macosOptions: null,
      gamePath: '/games/sdv',
    });

    expect(result.mode).toBe('failed');
  });

  it('ignores the macOS value on Linux', async () => {
    runningOn('linux');
    const result = await writeSteamLaunchOptions({
      appId: 413150,
      windowsOptions: null,
      linuxOptions: null,
      macosOptions: 'only-for-mac',
      gamePath: '/games/sdv',
    });

    expect(result.mode).toBe('noop');
    expect(result.reason).toBe(NOTHING_FOR_THIS_OS);
  });
});

describe('needsGameDir', () => {
  it('reads the column belonging to the current OS', () => {
    const onlyMacUsesToken = game({ linux: 'plain-flag', macos: '"{GAME_DIR}/x"' });

    runningOn('macos');
    expect(needsGameDir(onlyMacUsesToken)).toBe(true);

    runningOn('linux');
    expect(needsGameDir(onlyMacUsesToken)).toBe(false);
  });

  it('does not see the Linux token from macOS', () => {
    runningOn('macos');
    expect(needsGameDir(game({ linux: '"{GAME_DIR}/x"' }))).toBe(false);
  });

  it('reads the Windows column on Windows', () => {
    runningOn('windows');
    expect(needsGameDir(game({ windows: '"{GAME_DIR}\\x.exe"' }))).toBe(true);
    expect(needsGameDir(game({ macos: '"{GAME_DIR}/x"' }))).toBe(false);
  });
});
