import { setTimeout as sleep } from 'node:timers/promises';
import { F } from '@mobily/ts-belt';
import { type BrowserWindow, Notification } from 'electron';
import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { getAllInstalledGameIds } from '@/main/installer/cache';
import {
  applyQueuedMillenniumAction,
  millenniumQueueContext,
  notifyMillenniumStateChanged,
} from '@/main/millennium-install/apply';
import { isCefFlagFilePresent } from '@/main/utils/cef-flag-file';
import { detectMillennium } from '@/main/utils/millennium';
import {
  isSteamRunningSync,
  removeMillenniumPluginFiles,
  setMillenniumPluginEnabledInConfig,
} from '@/main/utils/millennium-plugin';
import { isMacOS, isWindows } from '@/main/utils/platform';
import { getSteamBridgeStatus, onSteamBridgeReady } from '@/main/utils/steam-bridge';
import {
  type WriteLaunchOptionsParams,
  writeSteamLaunchOptions,
} from '@/main/utils/steam-launch-options';
import { isSteamRunning } from '@/main/utils/steam-launcher';
import { waitForSteamGone } from '@/main/utils/steam-process';
import {
  deleteStoreValue,
  isCefDebuggingEnabledInSettings,
  readStoreValue,
  writeStoreValue,
} from '@/main/utils/store-storage';
import { getIcon } from '@/main/utils/theme';
import { getMainWindow } from '@/main/window';
import { plural } from '@/shared/plural';
import type { SteamBridgeStatusCode } from '@/shared/types';

export type PendingSteamAction =
  | {
      kind: 'launch-options';
      gameId: string;
      gameName: string;
      accountId: string | null;
      params: WriteLaunchOptionsParams;
      queuedAt: string;
    }
  | { kind: 'millennium-plugin'; enable: boolean; queuedAt: string }
  // No paths in these: the store key is renderer-writable, so main derives staging and mode itself.
  | { kind: 'millennium-activate'; tag: string; queuedAt: string; attempts: number }
  | { kind: 'millennium-deactivate'; purge: boolean; queuedAt: string; attempts: number };

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

interface PendingRunResult {
  appliedGameIds: string[];
  failed: { gameId: string; reason: string }[];
}

const QUEUE_KEY = 'pending-steam-actions';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const POLL_MS = isWindows() ? 15000 : 10000;
// Idle wake-ups only read the store and stat a file; no process is spawned.
const IDLE_MS = 60000;
const STEAM_GONE_TIMEOUT_MS = 30000;
const MILLENNIUM_MAX_ATTEMPTS = 5;
const ACTIVATE_KEYS = ['kind', 'tag', 'queuedAt', 'attempts'];
const DEACTIVATE_KEYS = ['kind', 'purge', 'queuedAt', 'attempts'];
// Steam and Millennium flush their configs right after the processes disappear.
const EXIT_SETTLE_MS = 2000;
// Slightly longer than the bridge's post-launch verification window.
const POST_START_RECHECK_MS = 65000;

function isLaunchOptionsParams(value: unknown): value is WriteLaunchOptionsParams {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const p = value as Record<string, unknown>;
  const optional = (v: unknown) => v === null || typeof v === 'string';
  return (
    typeof p.appId === 'number' &&
    Number.isInteger(p.appId) &&
    p.appId > 0 &&
    optional(p.windowsOptions) &&
    optional(p.linuxOptions) &&
    optional(p.macosOptions) &&
    (p.gamePath === undefined || optional(p.gamePath))
  );
}

// Main-only key, but the renderer's generic store setter can write any name, so the shape is checked.
export function isPendingSteamAction(value: unknown): value is PendingSteamAction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const a = value as Record<string, unknown>;
  if (typeof a.queuedAt !== 'string') {
    return false;
  }
  if (a.kind === 'millennium-plugin') {
    return typeof a.enable === 'boolean';
  }
  if (a.kind === 'millennium-activate' || a.kind === 'millennium-deactivate') {
    const allowed = a.kind === 'millennium-activate' ? ACTIVATE_KEYS : DEACTIVATE_KEYS;
    return (
      Object.keys(a).every((key) => allowed.includes(key)) &&
      typeof a.attempts === 'number' &&
      Number.isInteger(a.attempts) &&
      a.attempts >= 0 &&
      (a.kind === 'millennium-activate'
        ? typeof a.tag === 'string' && /^[\w.-]{1,64}$/.test(a.tag)
        : typeof a.purge === 'boolean')
    );
  }
  return (
    a.kind === 'launch-options' &&
    typeof a.gameId === 'string' &&
    typeof a.gameName === 'string' &&
    (a.accountId === null || typeof a.accountId === 'string') &&
    isLaunchOptionsParams(a.params)
  );
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
      void refreshBridgeStatus();
    });
  }
  wakeMonitor();
}

export function getPendingSteamActions(): PendingSteamAction[] {
  return readQueue();
}

const exitedListeners = new Set<() => Promise<void> | void>();
const startedListeners = new Set<() => void>();

export function onSteamExited(cb: () => Promise<void> | void): () => void {
  exitedListeners.add(cb);
  return () => {
    exitedListeners.delete(cb);
  };
}

export function onSteamStarted(cb: () => void): () => void {
  startedListeners.add(cb);
  return () => {
    startedListeners.delete(cb);
  };
}

async function fireExited(): Promise<void> {
  for (const listener of exitedListeners) {
    try {
      await listener();
    } catch (error) {
      console.warn('[PendingActions] Steam exit listener failed:', error);
    }
  }
}

function fireStarted(): void {
  for (const listener of startedListeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[PendingActions] Steam start listener failed:', error);
    }
  }
}

let pushWindow: BrowserWindow | null = null;

function targetWindow(): BrowserWindow | null {
  const win = pushWindow && !pushWindow.isDestroyed() ? pushWindow : getMainWindow();
  return win && !win.isDestroyed() ? win : null;
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
      const win = targetWindow();
      if (win) {
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
    let millenniumChanged = false;

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
        millenniumChanged ||= isMillenniumInstallAction(action);
        console.log(
          `[PendingActions] Dropped stale ${action.kind}${action.kind === 'launch-options' ? ` for ${action.gameName}` : ''}`
        );
        continue;
      }

      if (isMillenniumInstallAction(action)) {
        // Unknown counts as running: Steam's files must not change under it.
        if (isSteamRunningSync() !== false) {
          continue;
        }
        const outcome = applyQueuedMillenniumAction(action);
        millenniumChanged = true;
        if (outcome === 'retry') {
          bumped.add(actionKey(action));
        } else {
          removed.add(actionKey(action));
        }
        continue;
      }

      if (action.kind === 'millennium-plugin') {
        const outcome = setMillenniumPluginEnabledInConfig(action.enable);
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
        reason = error instanceof Error ? error.message : String(error);
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
      void refreshBridgeStatus();
    }
    if (millenniumChanged) {
      notifyMillenniumStateChanged();
    }
    if (result.appliedGameIds.length > 0) {
      targetWindow()?.webContents.send('steam-pending-actions-applied', {
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
    bridgeUp = false;
    await fireExited();
  }
  return result;
}

let batchChain: Promise<unknown> = Promise.resolve();

export function runPendingSteamActions(
  trigger: PendingTrigger
): Promise<PendingRunResult> {
  const run = batchChain.then(() => runBatch(trigger));
  batchChain = run.catch(() => undefined);
  return run;
}

let started = false;
let paused = 0;
let timer: NodeJS.Timeout | null = null;
let ticking = false;
let lastRunning: boolean | null = null;
let bridgeUp = false;
let lastBridgeCode: SteamBridgeStatusCode | null = null;
let bridgeCandidate = false;

async function refreshBridgeStatus(): Promise<void> {
  try {
    const status = await getSteamBridgeStatus();
    lastBridgeCode = status.code;
    bridgeUp = status.transport !== null;
  } catch (error) {
    console.warn('[PendingActions] Steam bridge status refresh failed:', error);
  }
}

// Cheap predicate for "the bridge may be waiting for a Steam restart"; confirmed via the real status.
function bridgeMayAwaitRestart(): boolean {
  return (
    !bridgeUp &&
    lastBridgeCode !== 'cef-blocked' &&
    isCefDebuggingEnabledInSettings() &&
    isCefFlagFilePresent() &&
    !detectMillennium().blocksTcpCdp
  );
}

function needsSteamPolling(): boolean {
  if (readQueue().length > 0) {
    return true;
  }
  return !bridgeUp && lastBridgeCode === 'restart-pending';
}

function schedule(ms: number): void {
  if (!started) {
    return;
  }
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    void tick();
  }, ms);
}

function wakeMonitor(): void {
  if (started && !ticking) {
    schedule(0);
  }
}

const schedulePostStartRecheck = F.debounce(() => {
  void refreshBridgeStatus().then(wakeMonitor);
}, POST_START_RECHECK_MS);

async function handleSteamStopped(): Promise<void> {
  bridgeUp = false;
  await waitForSteamGone(STEAM_GONE_TIMEOUT_MS);
  await sleep(EXIT_SETTLE_MS);
  if (await isSteamRunning()) {
    console.log('[PendingActions] Steam came back before the queue could run');
    await fireExited();
    lastRunning = true;
    fireStarted();
    schedulePostStartRecheck();
    return;
  }
  await runPendingSteamActions('steam-exit');
}

async function tick(): Promise<void> {
  timer = null;
  ticking = true;
  try {
    if (paused > 0) {
      lastRunning = null;
      return;
    }
    if (!needsSteamPolling()) {
      lastRunning = null;
      const candidate = bridgeMayAwaitRestart();
      if (candidate && !bridgeCandidate) {
        await refreshBridgeStatus();
      }
      bridgeCandidate = candidate;
      if (!needsSteamPolling()) {
        return;
      }
    }

    const running = await isSteamRunning();
    const previous = lastRunning;
    lastRunning = running;
    if (previous === null) {
      if (!running && readQueue().length > 0) {
        await handleSteamStopped();
      }
    } else if (previous && !running) {
      console.log('[PendingActions] Steam exited');
      await handleSteamStopped();
    } else if (!previous && running) {
      console.log('[PendingActions] Steam started');
      fireStarted();
      schedulePostStartRecheck();
    }
  } catch (error) {
    console.warn('[PendingActions] Steam monitor tick failed:', error);
  } finally {
    ticking = false;
    schedule(paused === 0 && needsSteamPolling() ? POLL_MS : IDLE_MS);
  }
}

// LBK's own restart runs the queue in its gap; the monitor must not race it or see the exit twice.
export function pauseSteamMonitor(): () => void {
  paused += 1;
  let resumed = false;
  return () => {
    if (resumed) {
      return;
    }
    resumed = true;
    paused -= 1;
    if (paused === 0) {
      lastRunning = null;
      schedulePostStartRecheck();
      wakeMonitor();
    }
  };
}

export function startPendingSteamActions(win: BrowserWindow | null): void {
  pushWindow = win;
  if (started) {
    return;
  }
  started = true;

  onSteamBridgeReady(() => {
    bridgeUp = true;
    if (readQueue().some((a) => a.kind === 'launch-options')) {
      setImmediate(() => {
        runPendingSteamActions('bridge-ready').catch((error) => {
          console.warn('[PendingActions] Live apply failed:', error);
        });
      });
    }
  });

  void (async () => {
    ticking = true;
    try {
      const running = await isSteamRunning();
      if (!running && readQueue().length > 0) {
        await runPendingSteamActions('startup');
      }
      lastRunning = running;
      await refreshBridgeStatus();
      bridgeCandidate = bridgeMayAwaitRestart();
    } catch (error) {
      console.warn('[PendingActions] Startup check failed:', error);
    } finally {
      ticking = false;
      schedule(needsSteamPolling() ? POLL_MS : IDLE_MS);
    }
  })();
}
