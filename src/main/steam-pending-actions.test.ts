import { describe, expect, it, vi } from 'vitest';
import type { PendingSteamAction } from '@/main/steam-pending-actions/queue';

const store = vi.hoisted(() => new Map<string, unknown>());

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
  isSteamRunning: () => Promise.resolve(false),
  isSteamStopped: () => Promise.resolve(true),
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
});
