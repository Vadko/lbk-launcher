import { appEvents } from '@/main/app-events';
import { applyQueuedMillenniumAction } from '@/main/millennium-install/apply';
import { isSteamRunning, isSteamStopped } from '@/main/steam-process/lifecycle';
import {
  removeMillenniumPluginFiles,
  setMillenniumPluginEnabledInConfig,
} from '@/main/utils/millennium-plugin';
import { writeSteamLaunchOptions } from '@/main/utils/steam-launch-options';
import { errorMessage } from '@/shared/errors';
import type { PendingActionKind, PendingActionOf, PendingTrigger } from './queue';

// `applied` and `failed` leave the queue, `keep` waits as it is, `retry` waits and counts an attempt.
export type HandlerResult =
  | { outcome: 'applied' }
  | { outcome: 'keep' }
  | { outcome: 'retry' }
  | { outcome: 'failed'; reason: string };

type Handlers = {
  [K in PendingActionKind]: (
    action: PendingActionOf<K>,
    trigger: PendingTrigger
  ) => Promise<HandlerResult>;
};

const keep: HandlerResult = { outcome: 'keep' };

async function applyMillenniumInstall(
  action: PendingActionOf<'millennium-activate' | 'millennium-deactivate'>
): Promise<HandlerResult> {
  if (!(await isSteamStopped())) {
    return keep;
  }
  const report = await applyQueuedMillenniumAction(action);
  // Whichever batch takes the item, the click that queued it waits for this report.
  appEvents.emit('millennium-applied', report);
  if (report.outcome === 'retry') {
    return { outcome: 'retry' };
  }
  return report.outcome === 'applied'
    ? { outcome: 'applied' }
    : { outcome: 'failed', reason: report.reason ?? 'script-failed' };
}

async function applyPluginToggle(
  action: PendingActionOf<'millennium-plugin'>
): Promise<HandlerResult> {
  const outcome = await setMillenniumPluginEnabledInConfig(action.enable);
  if (outcome === 'steam-running') {
    return keep;
  }
  if (outcome === 'invalid-config' || outcome === 'no-config') {
    console.warn(
      `[PendingActions] Millennium plugin ${action.enable ? 'enable' : 'disable'} skipped: ${outcome}`
    );
    return { outcome: 'failed', reason: outcome };
  }
  if (!action.enable) {
    removeMillenniumPluginFiles();
  }
  return { outcome: 'applied' };
}

async function applyLaunchOptions(
  action: PendingActionOf<'launch-options'>,
  trigger: PendingTrigger
): Promise<HandlerResult> {
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
    return keep;
  }
  // A live bridge call can fail transiently; the file write on Steam's exit is still ahead.
  if (
    mode === 'failed' &&
    (trigger === 'bridge-ready' || trigger === 'manual') &&
    (await isSteamRunning())
  ) {
    return keep;
  }
  if (mode === 'file' || mode === 'cef' || mode === 'noop') {
    return { outcome: 'applied' };
  }
  console.warn(
    `[PendingActions] Dropping launch options for ${action.gameName}: ${reason ?? mode}`
  );
  return { outcome: 'failed', reason: reason ?? mode };
}

const HANDLERS: Handlers = {
  'launch-options': applyLaunchOptions,
  'millennium-plugin': applyPluginToggle,
  'millennium-activate': applyMillenniumInstall,
  'millennium-deactivate': applyMillenniumInstall,
};

export function applyPendingAction<K extends PendingActionKind>(
  action: PendingActionOf<K>,
  trigger: PendingTrigger
): Promise<HandlerResult> {
  const handler: Handlers[K] = HANDLERS[action.kind];
  return handler(action, trigger);
}
