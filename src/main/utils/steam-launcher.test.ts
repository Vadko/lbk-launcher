import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSteamPids: vi.fn<() => Promise<number[] | null>>(),
  waitForSteamGone: vi.fn<() => Promise<boolean>>(),
  execFileOnHost: vi.fn(() => Promise.resolve({ stdout: '', stderr: '' })),
  spawnOnHost: vi.fn(),
}));

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }));
vi.mock('@/main/game-detector/steam', () => ({
  getSteamExePath: () => null,
  getSteamPath: () => '/home/u/.local/share/Steam',
}));
vi.mock('@/main/millennium-install/launch-env', () => ({
  millenniumLaunchEnv: () => ({}),
}));
vi.mock('@/main/plugin-host/support', () => ({ steamTypeFromPath: () => 'native' }));
vi.mock('@/main/steam-process/lifecycle', () => ({
  isSteamElevated: () => Promise.resolve(false),
  isSteamRunning: () => Promise.resolve(true),
  listSteamPids: mocks.listSteamPids,
  waitForSteamGone: mocks.waitForSteamGone,
  waitForSteamStart: () => Promise.resolve(true),
}));
vi.mock('@/main/steam-process/list-windows', () => ({
  ownSessionFilter: () => Promise.resolve([]),
}));
vi.mock('@/main/steam-process/running-game', () => ({
  getRunningSteamGameId: () => Promise.resolve(null),
}));
vi.mock('@/main/utils/host-exec', () => ({
  execFileOnHost: mocks.execFileOnHost,
  isFlatpak: () => false,
  spawnOnHost: mocks.spawnOnHost,
  system32: (...segments: string[]) => segments.join('\\'),
}));
vi.mock('@/main/utils/millennium', () => ({ findMacMillenniumWrapper: () => null }));
vi.mock('@/main/utils/platform', () => ({
  forCurrentOS: (branches: Record<string, unknown>) => branches.linux,
  isGamescopeSession: () => false,
}));

const { restartSteamProcess } = await import('./steam-launcher');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('restartSteamProcess', () => {
  it('leaves Steam alone when the listing before the shutdown fails', async () => {
    mocks.listSteamPids.mockResolvedValue(null);
    const beforeLaunch = vi.fn();

    expect(await restartSteamProcess({ beforeLaunch })).toEqual({
      success: false,
      reason: 'unknown-state',
    });
    expect(mocks.execFileOnHost).not.toHaveBeenCalled();
    expect(beforeLaunch).not.toHaveBeenCalled();
    expect(mocks.spawnOnHost).not.toHaveBeenCalled();
  });

  it('does not force kill when the listing after a slow exit fails', async () => {
    mocks.listSteamPids.mockResolvedValueOnce([10]).mockResolvedValueOnce(null);
    mocks.waitForSteamGone.mockResolvedValue(false);

    expect(await restartSteamProcess()).toEqual({
      success: false,
      reason: 'unknown-state',
    });
    expect(mocks.execFileOnHost.mock.calls).toEqual([['steam', ['-shutdown']]]);
  });

  it('starts Steam without a shutdown when it is not running', async () => {
    mocks.listSteamPids.mockResolvedValue([]);

    expect(await restartSteamProcess()).toEqual({ success: true });
    expect(mocks.execFileOnHost).not.toHaveBeenCalled();
    expect(mocks.spawnOnHost).toHaveBeenCalledWith('steam', [], {});
  });
});
