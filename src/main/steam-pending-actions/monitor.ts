import { setTimeout as sleep } from 'node:timers/promises';
import { F } from '@mobily/ts-belt';
import { type Actor, createActor, fromPromise } from 'xstate';
import { appEvents } from '@/main/app-events';
import { type BridgeFacts, steamMonitorMachine } from '@/main/steam-monitor-machine';
import { isSteamRunning, waitForSteamGone } from '@/main/steam-process/lifecycle';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium } from '@/main/utils/millennium';
import { getSteamBridgeStatus } from '@/main/utils/steam-bridge';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import { getPendingSteamActions, type PendingTrigger } from './queue';

type RunPending = (trigger: PendingTrigger) => Promise<unknown>;

const STEAM_GONE_TIMEOUT_MS = 30000;
// Steam and Millennium flush their configs right after the processes disappear.
const EXIT_SETTLE_MS = 2000;

let monitor: Actor<typeof steamMonitorMachine> | null = null;

export async function refreshBridgeFacts(): Promise<BridgeFacts | null> {
  try {
    const status = await getSteamBridgeStatus();
    const bridge = { up: status.transport !== null, code: status.code };
    monitor?.send({ type: 'BRIDGE_STATUS', bridge });
    return bridge;
  } catch (error) {
    console.warn('[PendingActions] Steam bridge status refresh failed:', error);
    return null;
  }
}

// Cheap predicate for "the bridge may be waiting for a Steam restart"; confirmed via the real status.
function bridgeMayAwaitRestart(bridge: BridgeFacts): boolean {
  return (
    !bridge.up &&
    bridge.code !== 'cef-blocked' &&
    isCefDebuggingEnabledInSettings() &&
    isCefFlagFilePresent() &&
    !detectMillennium().blocksTcpCdp
  );
}

// A throwing action or guard sends the actor to its error state, which ends Steam monitoring for the session.
function safely<T>(label: string, fallback: T, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    console.warn(`[PendingActions] ${label} failed:`, error);
    return fallback;
  }
}

function needsSteamPolling(bridge: BridgeFacts): boolean {
  if (getPendingSteamActions().length > 0) {
    return true;
  }
  return !bridge.up && bridge.code === 'restart-pending';
}

function implementation(runPending: RunPending) {
  return steamMonitorMachine.provide({
    actors: {
      startup: fromPromise(async () => {
        const running = await isSteamRunning();
        if (!running && getPendingSteamActions().length > 0) {
          await runPending('startup');
        }
        const bridge = await refreshBridgeFacts();
        return {
          running,
          candidate: bridgeMayAwaitRestart(bridge ?? { up: false, code: null }),
        };
      }),
      probe: fromPromise(async ({ input }) => {
        let bridge = input.bridge;
        let candidate: boolean | null = null;
        if (!needsSteamPolling(bridge)) {
          candidate = bridgeMayAwaitRestart(bridge);
          if (candidate && !input.candidate) {
            bridge = (await refreshBridgeFacts()) ?? bridge;
          }
          if (!needsSteamPolling(bridge)) {
            return { running: null, queued: false, candidate };
          }
        }
        const running = await isSteamRunning();
        return { running, queued: getPendingSteamActions().length > 0, candidate };
      }),
      handleStopped: fromPromise(async () => {
        await waitForSteamGone(STEAM_GONE_TIMEOUT_MS);
        await sleep(EXIT_SETTLE_MS);
        if (await isSteamRunning()) {
          return 'came-back' as const;
        }
        await runPending('steam-exit');
        return 'ran' as const;
      }),
      refreshBridge: fromPromise(() => refreshBridgeFacts()),
    },
    actions: {
      fireStarted: () => {
        safely('Steam start listeners', false, () => appEvents.emit('steam-started'));
      },
      fireExited: () => {
        safely('Steam exit listeners', false, () => appEvents.emit('steam-exited'));
      },
      applyLiveLaunchOptions: () => {
        const queued = safely('Queue read', false, () =>
          getPendingSteamActions().some((a) => a.kind === 'launch-options')
        );
        if (queued) {
          setImmediate(() => {
            runPending('bridge-ready').catch((error) => {
              console.warn('[PendingActions] Live apply failed:', error);
            });
          });
        }
      },
    },
    guards: {
      needsPolling: ({ context }) =>
        safely('Queue read', false, () => needsSteamPolling(context.bridge)),
    },
  });
}

export function wakeSteamMonitor(): void {
  monitor?.send({ type: 'WAKE' });
}

// LBK's own restart runs the queue in its gap; the monitor must not race it or see the exit twice.
export function pauseSteamMonitor(): () => void {
  const paused = monitor;
  paused?.send({ type: 'PAUSE' });
  return F.once(() => {
    paused?.send({ type: 'RESUME' });
  });
}

export function startSteamMonitor(runPending: RunPending): void {
  if (monitor) {
    return;
  }
  monitor = createActor(implementation(runPending));
  monitor.subscribe({
    error: (error) => console.error('[PendingActions] Steam monitor stopped:', error),
  });
  appEvents.on('bridge-ready', () => monitor?.send({ type: 'BRIDGE_READY' }));
  appEvents.on('steam-exited', () => monitor?.send({ type: 'STEAM_EXITED' }));
  monitor.start();
}
