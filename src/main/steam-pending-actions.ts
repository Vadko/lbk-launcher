import { F } from '@mobily/ts-belt';
import pLimit from 'p-limit';
import { appEvents } from '@/main/app-events';
import { getCurrentSteamAccountId } from '@/main/game-detector/steam';
import { getAllInstalledGameIds } from '@/main/installer/cache';
import { millenniumQueueContext } from '@/main/millennium-install/apply';
import { applyPendingAction } from '@/main/steam-pending-actions/handlers';
import {
  refreshBridgeFacts,
  startSteamMonitor,
  wakeSteamMonitor,
} from '@/main/steam-pending-actions/monitor';
import {
  actionKey,
  bumpAttempts,
  classifyPendingAction,
  getPendingSteamActions,
  orderPendingQueue,
  type PendingSteamAction,
  type PendingTrigger,
  reducePendingQueue,
  writeQueue,
} from '@/main/steam-pending-actions/queue';
import { isCefDebuggingEnabledInSettings } from '@/main/utils/store-storage';
import { showSystemNotification } from '@/main/utils/system-notification';
import { sendToRenderer } from '@/main/window';
import { t } from '@/shared/i18n/i18n';

export interface PendingRunResult {
  appliedGameIds: string[];
  failed: { gameId: string; reason: string }[];
}

export function queueSteamAction(a: PendingSteamAction): void {
  writeQueue(reducePendingQueue(getPendingSteamActions(), a));
  if (a.kind === 'launch-options') {
    console.log(
      `[PendingActions] Queued launch options for ${a.gameName} until Steam exits`
    );
    setImmediate(() => {
      void refreshBridgeFacts();
    });
  }
  wakeSteamMonitor();
}

function notifyApplied(names: string[], trigger: PendingTrigger): void {
  if (names.length === 0) {
    return;
  }
  const target =
    names.length === 1
      ? t('pendingLaunchOptions.gameName', { name: names[0] })
      : t('pendingLaunchOptions.games', { count: names.length });
  const lead =
    trigger === 'bridge-ready'
      ? t('pendingLaunchOptions.bridgeReady')
      : t('pendingLaunchOptions.steamClosed');
  showSystemNotification({
    title: t('pendingLaunchOptions.appliedTitle'),
    body: t('pendingLaunchOptions.appliedBody', { lead, target }),
  });
}

async function applyQueue(
  queue: PendingSteamAction[],
  trigger: PendingTrigger
): Promise<PendingRunResult> {
  const result: PendingRunResult = { appliedGameIds: [], failed: [] };
  const removed = new Set<string>();
  const bumped = new Set<string>();
  const appliedNames: string[] = [];
  const ctx = {
    now: Date.now(),
    accountId: getCurrentSteamAccountId(),
    installedGameIds: new Set(
      queue.some((a) => a.kind === 'launch-options') ? await getAllInstalledGameIds() : []
    ),
    settingOn: isCefDebuggingEnabledInSettings(),
    millennium: millenniumQueueContext(),
  };

  for (const action of orderPendingQueue(queue)) {
    // Config edits need Steam off, which a live bridge implies it is not.
    if (trigger === 'bridge-ready' && action.kind !== 'launch-options') {
      continue;
    }
    const decision = classifyPendingAction(action, ctx);
    if (decision === 'drop') {
      const game = action.kind === 'launch-options' ? ` for ${action.gameName}` : '';
      console.log(`[PendingActions] Dropped stale ${action.kind}${game}`);
    }
    const handled =
      decision === 'apply' ? await applyPendingAction(action, trigger) : null;
    if (decision === 'keep' || handled?.outcome === 'keep') {
      continue;
    }
    if (handled?.outcome === 'retry') {
      bumped.add(actionKey(action));
      continue;
    }
    removed.add(actionKey(action));
    if (action.kind === 'launch-options' && handled?.outcome === 'applied') {
      result.appliedGameIds.push(action.gameId);
      appliedNames.push(action.gameName);
    } else if (action.kind === 'launch-options' && handled?.outcome === 'failed') {
      result.failed.push({ gameId: action.gameId, reason: handled.reason });
    }
  }

  if (removed.size > 0 || bumped.size > 0) {
    // Re-read: an install may have queued a newer item while the writes were awaited.
    writeQueue(
      getPendingSteamActions()
        .filter((a) => !removed.has(actionKey(a)))
        .map((a) => (bumped.has(actionKey(a)) ? bumpAttempts(a) : a))
    );
    void refreshBridgeFacts();
  }
  if (result.appliedGameIds.length > 0) {
    sendToRenderer('steam-pending-actions-applied', { gameIds: result.appliedGameIds });
    if (trigger === 'steam-exit' || trigger === 'startup' || trigger === 'bridge-ready') {
      notifyApplied(appliedNames, trigger);
    }
  }
  return result;
}

async function runBatch(trigger: PendingTrigger): Promise<PendingRunResult> {
  const queue = getPendingSteamActions();
  const result =
    queue.length > 0
      ? await applyQueue(queue, trigger)
      : { appliedGameIds: [], failed: [] };
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

export const startPendingSteamActions = F.once((): void => {
  startSteamMonitor(runPendingSteamActions);
});
