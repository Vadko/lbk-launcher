import { describe, expect, it, vi } from 'vitest';
import type { RestartSteamResult } from '@/shared/plugin-host-types';

const mocks = vi.hoisted(() => ({
  restartSteamProcess:
    vi.fn<
      (opts: { beforeLaunch?: () => Promise<void> | void }) => Promise<RestartSteamResult>
    >(),
  verifyBridgeAfterLaunch: vi.fn(() => Promise.resolve('ready' as const)),
}));

vi.mock('@/main/game-detector', () => ({ getFirstAvailableGamePath: vi.fn() }));
vi.mock('@/main/game-detector/steam', () => ({ getCurrentSteamAccountId: () => null }));
vi.mock('@/main/installer/cache', () => ({ checkInstallation: vi.fn() }));
vi.mock('@/main/steam-pending-actions', () => ({
  getPendingSteamActions: () => [],
  pauseSteamMonitor: () => () => undefined,
  queueSteamAction: vi.fn(),
  runPendingSteamActions: () => Promise.resolve({ appliedGameIds: [], failed: [] }),
}));
vi.mock('@/main/utils/cef-flag-file', () => ({ setCefDebuggingEnabled: vi.fn() }));
vi.mock('@/main/utils/steam-bridge', () => ({
  verifyBridgeAfterLaunch: mocks.verifyBridgeAfterLaunch,
}));
vi.mock('@/main/utils/steam-launch-options', () => ({
  launchOptionsParamsFor: vi.fn(),
  needsGameDir: vi.fn(),
}));
vi.mock('@/main/utils/steam-launcher', () => ({
  restartSteamProcess: mocks.restartSteamProcess,
}));
vi.mock('@/main/steam-process/lifecycle', () => ({
  waitForSteamStart: () => Promise.resolve(true),
}));
vi.mock('@/main/utils/store-storage', () => ({
  isCefDebuggingEnabledInSettings: () => false,
}));

const { restartSteamOrchestrated } = await import('@/main/steam-restart');

describe('restartSteamOrchestrated', () => {
  it('runs one restart for concurrent callers and still verifies for the one that asked', async () => {
    let finish: () => Promise<void> = () => Promise.resolve();
    mocks.restartSteamProcess.mockImplementation(
      ({ beforeLaunch }) =>
        new Promise((resolve) => {
          finish = async () => {
            await beforeLaunch?.();
            resolve({ success: true });
          };
        })
    );

    const background = restartSteamOrchestrated({ verifyBridge: false });
    const joined = restartSteamOrchestrated({ verifyBridge: true });
    await finish();

    expect((await background).result).toEqual({ success: true });
    expect((await joined).result).toEqual({ success: true, bridge: 'ready' });
    expect(mocks.restartSteamProcess).toHaveBeenCalledTimes(1);

    mocks.restartSteamProcess.mockResolvedValue({ success: true });
    await restartSteamOrchestrated({ verifyBridge: false });
    expect(mocks.restartSteamProcess).toHaveBeenCalledTimes(2);
  });
});
