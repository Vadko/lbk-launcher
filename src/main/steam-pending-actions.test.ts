import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PendingSteamAction } from '@/main/steam-pending-actions/queue';

const store = vi.hoisted(() => new Map<string, unknown>());
const steam = vi.hoisted(() => ({ stopped: true }));

// Everything that reaches Steam, Electron or disk is stubbed; the store is an in-memory map.
vi.mock('@/main/game-detector/steam', () => ({ getCurrentSteamAccountId: () => null }));
vi.mock('@/main/installer/cache', () => ({
  getAllInstalledGameIds: () => Promise.resolve([]),
}));
vi.mock('@/main/millennium-install/apply', () => ({
  applyQueuedMillenniumAction: vi.fn(),
  millenniumQueueContext: vi.fn(),
}));
vi.mock('@/main/utils/cef-flag-file', () => ({ isCefFlagFilePresent: () => false }));
vi.mock('@/main/utils/millennium', () => ({ detectMillennium: vi.fn() }));
vi.mock('@/main/utils/millennium-plugin', () => ({
  removeMillenniumPluginFiles: vi.fn(),
  setMillenniumPluginEnabledInConfig: vi.fn(),
}));
vi.mock('@/main/utils/steam-bridge', () => ({ getSteamBridgeStatus: vi.fn() }));
vi.mock('@/main/utils/steam-launch-options', () => ({
  writeSteamLaunchOptions: vi.fn(),
}));
vi.mock('@/main/steam-process/lifecycle', () => ({
  isSteamRunning: () => Promise.resolve(!steam.stopped),
  isSteamStopped: () => Promise.resolve(steam.stopped),
  probeSteamRunning: () => Promise.resolve(!steam.stopped),
  waitForSteamGone: () => Promise.resolve(true),
}));
vi.mock('@/main/utils/store-storage', () => ({
  deleteStoreValue: (key: string) => store.delete(key),
  isCefDebuggingEnabledInSettings: () => true,
  onStoreValueChanged: () => () => undefined,
  readStoreValue: (key: string) => store.get(key),
  writeStoreValue: (key: string, value: unknown) => store.set(key, value),
}));
vi.mock('@/main/utils/system-notification', () => ({ showSystemNotification: vi.fn() }));
vi.mock('@/main/window', () => ({ sendToRenderer: () => undefined }));

const { appEvents } = await import('@/main/app-events');
const { applyQueuedMillenniumAction, millenniumQueueContext } = await import(
  '@/main/millennium-install/apply'
);
const { runPendingSteamActions } = await import('@/main/steam-pending-actions');

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  store.clear();
  steam.stopped = true;
});

function activate(): PendingSteamAction {
  return {
    kind: 'millennium-activate',
    tag: 'v3.5.0',
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
}

describe('runPendingSteamActions', () => {
  it('reports a Millennium apply on the bus from whichever batch takes the item', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    store.set('pending-steam-actions', [activate()]);
    vi.mocked(millenniumQueueContext).mockReturnValue({
      pinTag: 'v3.5.0',
      stagingReady: () => true,
      recordPresent: true,
    });
    vi.mocked(applyQueuedMillenniumAction).mockResolvedValue({
      kind: 'activate',
      outcome: 'applied',
    });
    const reports: unknown[] = [];
    const onApplied = (report: unknown) => reports.push(report);
    appEvents.on('millennium-applied', onApplied);

    const exitRun = runPendingSteamActions('steam-exit');
    const clickRun = runPendingSteamActions('manual');
    await Promise.all([exitRun, clickRun]);
    appEvents.off('millennium-applied', onApplied);

    expect(applyQueuedMillenniumAction).toHaveBeenCalledTimes(1);
    expect(reports).toEqual([{ kind: 'activate', outcome: 'applied' }]);
    expect(store.has('pending-steam-actions')).toBe(false);
  });

  it('retries a locked Millennium apply while Steam stays closed', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    store.set('pending-steam-actions', [activate()]);
    vi.mocked(millenniumQueueContext).mockReturnValue({
      pinTag: 'v3.5.0',
      stagingReady: () => true,
      recordPresent: true,
    });
    vi.mocked(applyQueuedMillenniumAction)
      .mockResolvedValueOnce({
        kind: 'activate',
        outcome: 'retry',
        reason: 'files-locked',
      })
      .mockResolvedValueOnce({ kind: 'activate', outcome: 'applied' });

    await runPendingSteamActions('manual');
    expect(store.get('pending-steam-actions')).toMatchObject([{ attempts: 1 }]);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(applyQueuedMillenniumAction).toHaveBeenCalledTimes(2);
    expect(store.has('pending-steam-actions')).toBe(false);
  });

  it('stops retrying once Steam is back, keeping the item for its next exit', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    store.set('pending-steam-actions', [activate()]);
    vi.mocked(millenniumQueueContext).mockReturnValue({
      pinTag: 'v3.5.0',
      stagingReady: () => true,
      recordPresent: true,
    });
    vi.mocked(applyQueuedMillenniumAction).mockResolvedValue({
      kind: 'activate',
      outcome: 'retry',
      reason: 'files-locked',
    });

    await runPendingSteamActions('steam-exit');
    steam.stopped = false;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(applyQueuedMillenniumAction).toHaveBeenCalledTimes(1);
    expect(store.get('pending-steam-actions')).toMatchObject([{ attempts: 1 }]);
  });

  it('gives up after the attempts limit', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    store.set('pending-steam-actions', [activate()]);
    vi.mocked(millenniumQueueContext).mockReturnValue({
      pinTag: 'v3.5.0',
      stagingReady: () => true,
      recordPresent: true,
    });
    vi.mocked(applyQueuedMillenniumAction).mockResolvedValue({
      kind: 'activate',
      outcome: 'retry',
      reason: 'files-locked',
    });

    await runPendingSteamActions('steam-exit');
    await vi.advanceTimersByTimeAsync(120_000);

    expect(applyQueuedMillenniumAction).toHaveBeenCalledTimes(5);
    expect(store.has('pending-steam-actions')).toBe(false);
  });
});
