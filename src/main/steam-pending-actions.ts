import { setTimeout as sleep } from 'node:timers/promises';
import { F } from '@mobily/ts-belt';
import { Notification } from 'electron';
import pLimit from 'p-limit';
import { type Actor, createActor, fromPromise } from 'xstate';
import { z } from 'zod';
import { appEvents } from '@/main/app-events';
import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { getAllInstalledGameIds } from '@/main/installer/cache';
import {
  applyQueuedMillenniumAction,
  millenniumQueueContext,
} from '@/main/millennium-install/apply';
import { type BridgeFacts, steamMonitorMachine } from '@/main/steam-monitor-machine';
import {
  isSteamRunning,
  isSteamStopped,
  waitForSteamGone,
} from '@/main/steam-process/lifecycle';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium } from '@/main/utils/millennium';
import {
  removeMillenniumPluginFiles,
  setMillenniumPluginEnabledInConfig,
} from '@/main/utils/millennium-plugin';
import { isMacOS } from '@/main/utils/platform';
import { getSteamBridgeStatus } from '@/main/utils/steam-bridge';
import {
  type WriteLaunchOptionsParams,
  writeSteamLaunchOptions,
} from '@/main/utils/steam-launch-options';
import {
  deleteStoreValue,
  isCefDebuggingEnabledInSettings,
  onStoreValueChanged,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';
import { getIcon } from '@/main/utils/theme';
import { getMainWindow, sendToRenderer } from '@/main/window';
import { errorMessage } from '@/shared/errors';
import { plural } from '@/shared/plural';

const launchOptionsParamsSchema = z.object({
  appId: z.int().positive(),
  windowsOptions: z.string().nullable(),
  linuxOptions: z.string().nullable(),
  macosOptions: z.string().nullable(),
  gamePath: z.string().nullish(),
}) satisfies z.ZodType<WriteLaunchOptionsParams>;

const queuedAt = z.string();
const attempts = z.int().nonnegative();

const launchOptionsItem = z.object({
  kind: z.literal('launch-options'),
  gameId: z.string(),
  gameName: z.string(),
  accountId: z.string().nullable(),
  params: launchOptionsParamsSchema,
  queuedAt,
});
const pluginToggleItem = z.object({
  kind: z.literal('millennium-plugin'),
  enable: z.boolean(),
  queuedAt,
});
const activateItem = z.strictObject({
  kind: z.literal('millennium-activate'),
  tag: z.string().regex(/^[\w.-]{1,64}$/),
  queuedAt,
  attempts,
});
const deactivateItem = z.strictObject({
  kind: z.literal('millennium-deactivate'),
  purge: z.boolean(),
  queuedAt,
  attempts,
});

// The store key is renderer-writable: Millennium items carry no paths and reject extra keys, main derives the rest.
const pendingSteamActionSchema = z.discriminatedUnion('kind', [
  launchOptionsItem.loose(),
  pluginToggleItem.loose(),
  activateItem,
  deactivateItem,
]);

// Built from the non-loose shapes so queue items written in code keep excess-property checks.
export type PendingSteamAction =
  | z.infer<typeof launchOptionsItem>
  | z.infer<typeof pluginToggleItem>
  | z.infer<typeof activateItem>
  | z.infer<typeof deactivateItem>;

type MillenniumInstallAction = Extract<
  PendingSteamAction,
  { kind: 'millennium-activate' | 'millennium-deactivate' }
>;

type PendingTrigger =
  | 'steam-exit'
  | 'restart-gap'
  | 'startup'
  | 'bridge-ready'
  | 'manual';

export interface PendingRunResult {
  appliedGameIds: string[];
  failed: { gameId: string; reason: string }[];
}

const QUEUE_KEY = 'pending-steam-actions';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const STEAM_GONE_TIMEOUT_MS = 30000;
const MILLENNIUM_MAX_ATTEMPTS = 5;
// Steam and Millennium flush their configs right after the processes disappear.
const EXIT_SETTLE_MS = 2000;

// Stored items are kept as they are, unknown keys included; the schema only decides which survive.
export function isPendingSteamAction(value: unknown): value is PendingSteamAction {
  return pendingSteamActionSchema.safeParse(value).success;
}

function readQueue(): PendingSteamAction[] {
  const raw = readStoreValue(QUEUE_KEY);
  return Array.isArray(raw) ? raw.filter(isPendingSteamAction) : [];
}

function writeQueue(queue: PendingSteamAction[]): void {
  if (queue.length === 0) {
    deleteStoreValue(QUEUE_KEY);
    return;
  }
  writeStoreValue(QUEUE_KEY, queue);
}

function isMillenniumInstallAction(a: PendingSteamAction): a is MillenniumInstallAction {
  return a.kind === 'millennium-activate' || a.kind === 'millennium-deactivate';
}

function actionKey(a: PendingSteamAction): string {
  switch (a.kind) {
    case 'launch-options':
      return `launch-options:${a.gameId}:${a.queuedAt}`;
    case 'millennium-plugin':
      return `millennium-plugin:${a.enable}:${a.queuedAt}`;
    default:
      return `${a.kind}:${a.queuedAt}`;
  }
}

export function reducePendingQueue(
  q: PendingSteamAction[],
  a: PendingSteamAction
): PendingSteamAction[] {
  const rest = q.filter((item) => {
    if (a.kind === 'launch-options') {
      return !(item.kind === 'launch-options' && item.gameId === a.gameId);
    }
    // An install and an uninstall cancel each other; the plugin toggle is a separate concern.
    if (isMillenniumInstallAction(a)) {
      return !isMillenniumInstallAction(item);
    }
    return item.kind !== 'millennium-plugin';
  });
  return [...rest, a];
}

// Millennium installs first: the plugin toggle and its config edit only make sense afterwards.
export function orderPendingQueue(
  q: readonly PendingSteamAction[]
): PendingSteamAction[] {
  return [
    ...q.filter(isMillenniumInstallAction),
    ...q.filter((a) => !isMillenniumInstallAction(a)),
  ];
}

export function classifyPendingAction(
  a: PendingSteamAction,
  ctx: {
    now: number;
    accountId: string | null;
    installedGameIds: ReadonlySet<string>;
    settingOn: boolean;
    millennium: {
      pinTag: string | null;
      stagingReady: (tag: string) => boolean;
      recordPresent: boolean;
    };
  }
): 'apply' | 'keep' | 'drop' {
  const queuedAt = Date.parse(a.queuedAt);
  if (Number.isNaN(queuedAt) || ctx.now - queuedAt > MAX_AGE_MS) {
    return 'drop';
  }
  if (isMillenniumInstallAction(a)) {
    if (a.attempts >= MILLENNIUM_MAX_ATTEMPTS) {
      return 'drop';
    }
    if (a.kind === 'millennium-deactivate') {
      return ctx.millennium.recordPresent ? 'apply' : 'drop';
    }
    // An LBK update since queueing changed the pin, so the staged files are not the ones offered.
    return a.tag === ctx.millennium.pinTag && ctx.millennium.stagingReady(a.tag)
      ? 'apply'
      : 'drop';
  }
  if (a.kind === 'millennium-plugin') {
    // A toggle flipped back while the item waited makes it stale.
    return a.enable === ctx.settingOn ? 'apply' : 'drop';
  }
  if (!ctx.installedGameIds.has(a.gameId)) {
    return 'drop';
  }
  // localconfig.vdf is per account; another user's file must not get this game's options.
  if (a.accountId !== null && a.accountId !== ctx.accountId) {
    return 'keep';
  }
  return 'apply';
}

export function queueSteamAction(a: PendingSteamAction): void {
  writeQueue(reducePendingQueue(readQueue(), a));
  if (a.kind === 'launch-options') {
    console.log(
      `[PendingActions] Queued launch options for ${a.gameName} until Steam exits`
    );
    setImmediate(() => {
      void refreshBridgeFacts();
    });
  }
  monitor?.send({ type: 'WAKE' });
}

export function getPendingSteamActions(): PendingSteamAction[] {
  return readQueue();
}

export function onPendingSteamActionsChanged(callback: () => void): () => void {
  return onStoreValueChanged(QUEUE_KEY, callback);
}

function notifyApplied(names: string[], trigger: PendingTrigger): void {
  if (names.length === 0 || !Notification.isSupported()) {
    return;
  }
  const target =
    names.length === 1
      ? `«${names[0]}»`
      : `${names.length} ${plural(names.length, 'гри', 'ігор', 'ігор')}`;
  const lead =
    trigger === 'bridge-ready' ? 'Steam підключився до лаунчера' : 'Steam закрито';
  try {
    const notification = new Notification({
      title: 'Параметри запуску застосовано',
      body: `${lead} — параметри запуску для ${target} записано. Можна запускати гру.`,
      icon: isMacOS() ? undefined : getIcon('notification'),
    });
    notification.on('click', () => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.show();
        if (win.isMinimized()) {
          win.restore();
        }
        win.focus();
      }
    });
    notification.show();
  } catch (error) {
    console.warn('[PendingActions] Failed to show notification:', error);
  }
}

async function runBatch(trigger: PendingTrigger): Promise<PendingRunResult> {
  const result: PendingRunResult = { appliedGameIds: [], failed: [] };
  const queue = readQueue();
  if (queue.length > 0) {
    const removed = new Set<string>();
    const appliedNames: string[] = [];
    const ctx = {
      now: Date.now(),
      accountId: getCurrentSteamAccountId(),
      installedGameIds: new Set(
        queue.some((a) => a.kind === 'launch-options')
          ? await getAllInstalledGameIds()
          : []
      ),
      settingOn: isCefDebuggingEnabledInSettings(),
      millennium: millenniumQueueContext(),
    };
    const bumped = new Set<string>();

    for (const action of orderPendingQueue(queue)) {
      // Config edits need Steam off, which a live bridge implies it is not.
      if (
        (action.kind === 'millennium-plugin' || isMillenniumInstallAction(action)) &&
        trigger === 'bridge-ready'
      ) {
        continue;
      }
      const decision = classifyPendingAction(action, ctx);
      if (decision === 'keep') {
        continue;
      }
      if (decision === 'drop') {
        removed.add(actionKey(action));
        console.log(
          `[PendingActions] Dropped stale ${action.kind}${action.kind === 'launch-options' ? ` for ${action.gameName}` : ''}`
        );
        continue;
      }

      if (isMillenniumInstallAction(action)) {
        if (!(await isSteamStopped())) {
          continue;
        }
        const report = await applyQueuedMillenniumAction(action);
        // Whichever batch takes the item, the click that queued it waits for this report.
        appEvents.emit('millennium-applied', report);
        if (report.outcome === 'retry') {
          bumped.add(actionKey(action));
        } else {
          removed.add(actionKey(action));
        }
        continue;
      }

      if (action.kind === 'millennium-plugin') {
        const outcome = await setMillenniumPluginEnabledInConfig(action.enable);
        if (outcome === 'steam-running') {
          continue;
        }
        removed.add(actionKey(action));
        if (outcome === 'invalid-config' || outcome === 'no-config') {
          console.warn(
            `[PendingActions] Millennium plugin ${action.enable ? 'enable' : 'disable'} skipped: ${outcome}`
          );
        } else if (!action.enable) {
          removeMillenniumPluginFiles();
        }
        continue;
      }

      let mode: string;
      let reason: string | undefined;
      try {
        const write = await writeSteamLaunchOptions(action.params);
        mode = write.mode;
        reason = write.reason;
      } catch (error) {
        mode = 'failed';
        reason = errorMessage(error);
      }
      console.log(
        `[PendingActions] Launch options for ${action.gameName} (${trigger}) mode=${mode}${reason ? ` — ${reason}` : ''}`
      );
      if (mode === 'needs-shutdown') {
        continue;
      }
      // A live bridge call can fail transiently; the file write on Steam's exit is still ahead.
      if (
        mode === 'failed' &&
        (trigger === 'bridge-ready' || trigger === 'manual') &&
        (await isSteamRunning())
      ) {
        continue;
      }
      removed.add(actionKey(action));
      if (mode === 'file' || mode === 'cef' || mode === 'noop') {
        result.appliedGameIds.push(action.gameId);
        appliedNames.push(action.gameName);
      } else {
        console.warn(
          `[PendingActions] Dropping launch options for ${action.gameName}: ${reason ?? mode}`
        );
        result.failed.push({ gameId: action.gameId, reason: reason ?? mode });
      }
    }

    if (removed.size > 0 || bumped.size > 0) {
      // Re-read: an install may have queued a newer item while the writes were awaited.
      writeQueue(
        readQueue()
          .filter((a) => !removed.has(actionKey(a)))
          .map((a) =>
            isMillenniumInstallAction(a) && bumped.has(actionKey(a))
              ? { ...a, attempts: a.attempts + 1 }
              : a
          )
      );
      void refreshBridgeFacts();
    }
    if (result.appliedGameIds.length > 0) {
      sendToRenderer('steam-pending-actions-applied', {
        gameIds: result.appliedGameIds,
      });
      if (
        trigger === 'steam-exit' ||
        trigger === 'startup' ||
        trigger === 'bridge-ready'
      ) {
        notifyApplied(appliedNames, trigger);
      }
    }
  }

  if (trigger === 'steam-exit' || trigger === 'restart-gap') {
    appEvents.emit('steam-exited');
  }
  return result;
}

const runSerially = pLimit(1);

export function runPendingSteamActions(
  trigger: PendingTrigger
): Promise<PendingRunResult> {
  return runSerially(() => runBatch(trigger));
}

let monitor: Actor<typeof steamMonitorMachine> | null = null;

async function refreshBridgeFacts(): Promise<BridgeFacts | null> {
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
  if (readQueue().length > 0) {
    return true;
  }
  return !bridge.up && bridge.code === 'restart-pending';
}

const monitorImpl = steamMonitorMachine.provide({
  actors: {
    startup: fromPromise(async () => {
      const running = await isSteamRunning();
      if (!running && readQueue().length > 0) {
        await runPendingSteamActions('startup');
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
      return { running, queued: readQueue().length > 0, candidate };
    }),
    handleStopped: fromPromise(async () => {
      await waitForSteamGone(STEAM_GONE_TIMEOUT_MS);
      await sleep(EXIT_SETTLE_MS);
      if (await isSteamRunning()) {
        return 'came-back' as const;
      }
      await runPendingSteamActions('steam-exit');
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
        readQueue().some((a) => a.kind === 'launch-options')
      );
      if (queued) {
        setImmediate(() => {
          runPendingSteamActions('bridge-ready').catch((error) => {
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

// LBK's own restart runs the queue in its gap; the monitor must not race it or see the exit twice.
export function pauseSteamMonitor(): () => void {
  const paused = monitor;
  paused?.send({ type: 'PAUSE' });
  return F.once(() => {
    paused?.send({ type: 'RESUME' });
  });
}

export function startPendingSteamActions(): void {
  if (monitor) {
    return;
  }
  monitor = createActor(monitorImpl);
  monitor.subscribe({
    error: (error) => console.error('[PendingActions] Steam monitor stopped:', error),
  });
  appEvents.on('bridge-ready', () => monitor?.send({ type: 'BRIDGE_READY' }));
  appEvents.on('steam-exited', () => monitor?.send({ type: 'STEAM_EXITED' }));
  monitor.start();
}
