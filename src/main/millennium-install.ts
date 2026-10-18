import * as path from 'node:path';
import { appEvents } from '@/main/app-events';
import {
  downloadsDir,
  isStagingReady,
  type MillenniumApplyReport,
  markStagingReady,
  stagingDirFor,
  stagingRoot,
} from '@/main/millennium-install/apply';
import { extractMillenniumArchive } from '@/main/millennium-install/extract';
import { deleteInstallRecord, recordPathIn } from '@/main/millennium-install/record';
import { MILLENNIUM_PIN, pinnedTagFor } from '@/main/millennium-install/release';
import {
  deckyLoaderStateFor,
  deckyStateFor,
  getHostSnapshot,
  type HostSnapshot,
  hostTarget,
  pendingMillenniumAction,
  resetHostFacts,
} from '@/main/plugin-host/state';
import { queueSteamAction, runPendingSteamActions } from '@/main/steam-pending-actions';
import {
  getPendingSteamActions,
  onPendingSteamActionsChanged,
} from '@/main/steam-pending-actions/queue';
import { findSteamPids, isSteamElevated } from '@/main/steam-process/lifecycle';
import { restartSteamOrchestrated } from '@/main/steam-restart';
import { pruneDir } from '@/main/utils/fs-safe';
import { resetMillenniumDetectCache } from '@/main/utils/millennium';
import { downloadPinned, PinnedDownloadError } from '@/main/utils/pinned-download';
import { isGamescopeSession } from '@/main/utils/platform';
import { refreshSteamBridgeStatus } from '@/main/utils/steam-bridge';
import { sendToRenderer } from '@/main/window';
import { errorMessage } from '@/shared/errors';
import type {
  MillenniumInstallResult,
  MillenniumProgress,
  PluginHostState,
} from '@/shared/plugin-host-types';

let busy = false;
let prepared: { tag: string } | null = null;
let abort: AbortController | null = null;

function progress(p: MillenniumProgress): void {
  sendToRenderer('millennium:progress', p);
}

export async function getPluginHostState(): Promise<PluginHostState> {
  const snapshot = await getHostSnapshot();
  const steamRunning = (await findSteamPids()).length > 0;
  const elevated = steamRunning ? await isSteamElevated() : false;
  const { record, release, facts } = snapshot;
  const host = hostTarget(snapshot);

  let installed: PluginHostState['millennium']['installed'] = null;
  if (host && record) {
    const target = { ...host.target, record };
    installed = {
      managedBy: 'lbk',
      version: host.driver.installedVersion(target),
      mode: record.mode,
      needsRepair: host.driver.needsRepair(target),
    };
  } else if (facts.millenniumGeneration !== null || facts.linux?.systemMillennium) {
    installed = { managedBy: 'external', version: null, mode: null, needsRepair: false };
  }

  const update =
    record && host?.driver.offersUpdates && release && record.tag !== release.tag
      ? { version: release.version }
      : null;

  return {
    host: snapshot.host,
    millennium: {
      supported: snapshot.support.supported,
      unsupportedReason: snapshot.support.reason,
      installed,
      update,
      pending: pendingMillenniumAction(),
      downloadSize: release?.asset.size ?? null,
    },
    decky: deckyStateFor(snapshot.decky),
    deckyLoader: deckyLoaderStateFor(snapshot),
    busy,
    steamRunning,
    canRestartSteam: steamRunning && !elevated && !isGamescopeSession(),
  };
}

export async function publishPluginHostState(): Promise<void> {
  try {
    const state = await getPluginHostState();
    sendToRenderer('plugin-host:state-changed', state);
  } catch (error) {
    console.warn('[Millennium] State refresh failed:', error);
  }
  await refreshSteamBridgeStatus();
}

function setBusy(value: boolean): void {
  busy = value;
  void publishPluginHostState();
}

function fail(
  reason: NonNullable<MillenniumInstallResult['reason']>,
  error?: string
): MillenniumInstallResult {
  return { success: false, reason, error };
}

function checkConflict(snapshot: HostSnapshot): string | null {
  const host = hostTarget(snapshot);
  return host ? host.driver.conflict(host.target) : null;
}

async function stageRelease(
  snapshot: HostSnapshot,
  signal: AbortSignal
): Promise<MillenniumInstallResult | null> {
  const release = snapshot.release;
  if (!release) {
    return fail('unsupported', 'no-release');
  }
  const archive = path.join(downloadsDir(), path.posix.basename(release.asset.url));
  progress({ phase: 'download', percent: 0 });
  await downloadPinned(release.asset, archive, {
    signal,
    onProgress: (fraction) =>
      progress({ phase: 'download', percent: Math.round(fraction * 100) }),
  });
  progress({ phase: 'verify' });

  const staging = stagingDirFor(release.tag);
  progress({ phase: 'extract' });
  try {
    await extractMillenniumArchive(archive, release.asset.kind, staging);
  } catch (error) {
    console.warn('[Millennium] Extraction failed:', error);
    return fail('extract-failed', errorMessage(error));
  }

  const host = hostTarget(snapshot);
  const staged = host
    ? await host.driver.checkStaged(host.target, {
        dir: staging,
        version: release.version,
        hwArch: snapshot.hwArch,
      })
    : null;
  if (staged) {
    return fail(staged.reason, staged.error);
  }
  markStagingReady(release.tag);
  return null;
}

export async function prepareMillennium(): Promise<MillenniumInstallResult> {
  if (busy) {
    return fail('busy');
  }
  setBusy(true);
  const controller = new AbortController();
  abort = controller;
  try {
    resetHostFacts();
    resetMillenniumDetectCache();
    const snapshot = await getHostSnapshot();
    if (snapshot.host !== 'millennium' || !snapshot.support.supported || !snapshot.os) {
      return fail('unsupported', snapshot.support.reason ?? snapshot.host);
    }
    // A distro package in /usr/lib/millennium counts even before its links exist.
    if (
      !snapshot.record &&
      (snapshot.facts.millenniumGeneration !== null ||
        snapshot.facts.linux?.systemMillennium)
    ) {
      return fail('unsupported', 'external');
    }
    const conflict = checkConflict(snapshot);
    if (conflict) {
      console.warn(`[Millennium] Refusing to install over ${conflict}`);
      return fail('conflict', conflict);
    }
    const host = hostTarget(snapshot);
    const blocked = host ? host.driver.preflight(host.target) : null;
    if (blocked) {
      return fail(blocked);
    }

    const failure = await stageRelease(snapshot, controller.signal);
    if (failure) {
      return failure;
    }
    prepared = { tag: snapshot.release?.tag ?? '' };
    const state = await getPluginHostState();
    return {
      success: true,
      ready: true,
      steamRunning: state.steamRunning,
      canRestartSteam: state.canRestartSteam,
    };
  } catch (error) {
    if (error instanceof PinnedDownloadError) {
      console.warn(`[Millennium] Download ${error.kind}: ${error.message}`);
      return fail(error.kind, error.message);
    }
    console.error('[Millennium] Prepare failed:', error);
    return fail('extract-failed', errorMessage(error));
  } finally {
    abort = null;
    setBusy(false);
  }
}

export function cancelMillennium(): { success: boolean } {
  if (!abort) {
    return { success: false };
  }
  abort.abort();
  return { success: true };
}

function isQueued(kind: 'activate' | 'deactivate'): boolean {
  return pendingMillenniumAction() === kind;
}

function outcomeFailure(
  kind: 'activate' | 'deactivate',
  applied: MillenniumApplyReport | undefined
): MillenniumInstallResult | null {
  const report = applied?.kind === kind ? applied : undefined;
  if (report?.outcome === 'applied') {
    return null;
  }
  if (isQueued(kind)) {
    return { success: false, reason: 'files-locked', queued: true, error: report?.error };
  }
  return fail(report?.reason ?? 'script-failed', report?.error);
}

async function runQueuedChange(
  kind: 'activate' | 'deactivate',
  restart: 'now' | 'on-exit'
): Promise<MillenniumInstallResult> {
  let restarting = false;
  // The monitor's Steam-exit batch can take the item before the batch run here gets the queue.
  let applied: MillenniumApplyReport | undefined;
  const onApplied = (report: MillenniumApplyReport) => {
    applied = report;
  };
  const onPhase = (phase: 'install-files' | 'installed') => {
    if (phase === 'install-files') {
      progress({ phase: 'install-files' });
    } else if (restarting) {
      progress({ phase: 'start-steam' });
    }
  };
  appEvents.on('millennium-applied', onApplied);
  appEvents.on('millennium-phase', onPhase);
  try {
    if ((await findSteamPids()).length === 0) {
      await runPendingSteamActions('manual');
      return (
        outcomeFailure(kind, applied) ?? {
          success: true,
          bridge: 'unknown',
          steamRunning: false,
        }
      );
    }
    if (restart === 'on-exit') {
      return { success: true, queued: true };
    }

    restarting = true;
    progress({ phase: 'stop-steam' });
    const { result } = await restartSteamOrchestrated({
      verifyBridge: kind === 'activate',
    });
    if (!result.success) {
      return {
        success: false,
        reason: 'restart-failed',
        restartReason: result.reason,
        queued: isQueued(kind),
        error: result.error,
      };
    }
    const failure = outcomeFailure(kind, applied);
    if (failure) {
      return failure;
    }
    if (kind === 'deactivate') {
      return { success: true };
    }
    return {
      ...(await verifyActivation(result.bridge ?? 'unknown')),
      steamRunning: true,
    };
  } finally {
    appEvents.off('millennium-applied', onApplied);
    appEvents.off('millennium-phase', onPhase);
  }
}

async function verifyActivation(
  bridge: NonNullable<MillenniumInstallResult['bridge']>
): Promise<MillenniumInstallResult> {
  progress({ phase: 'wait-plugin' });
  const host = hostTarget(await getHostSnapshot());
  return host
    ? host.driver.verifyActivated(host.target, bridge)
    : { success: true, bridge };
}

export async function activateMillennium(opts: {
  restart: 'now' | 'on-exit';
}): Promise<MillenniumInstallResult> {
  if (busy) {
    return fail('busy');
  }
  const snapshot = await getHostSnapshot();
  const tag = snapshot.release?.tag;
  if (!tag || prepared?.tag !== tag || !isStagingReady(tag)) {
    return fail('not-prepared');
  }
  if (checkConflict(snapshot)) {
    return fail('conflict');
  }
  setBusy(true);
  try {
    queueSteamAction({
      kind: 'millennium-activate',
      tag,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
    const result = await runQueuedChange('activate', opts.restart);
    if (result.success && !result.queued) {
      prepared = null;
    }
    return result;
  } catch (error) {
    console.error('[Millennium] Activation failed:', error);
    return fail('script-failed', errorMessage(error));
  } finally {
    setBusy(false);
  }
}

export async function uninstallMillennium(opts: {
  purge: boolean;
  restart: 'now' | 'on-exit';
}): Promise<MillenniumInstallResult> {
  if (busy) {
    return fail('busy');
  }
  const snapshot = await getHostSnapshot();
  if (!snapshot.record) {
    return fail('unsupported', 'not installed by LBK');
  }
  setBusy(true);
  try {
    queueSteamAction({
      kind: 'millennium-deactivate',
      purge: opts.purge,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
    return await runQueuedChange('deactivate', opts.restart);
  } catch (error) {
    console.error('[Millennium] Uninstall failed:', error);
    return fail('script-failed', errorMessage(error));
  } finally {
    setBusy(false);
  }
}

function cleanupOrphans(snapshot: HostSnapshot): void {
  const pinTag = snapshot.os ? pinnedTagFor(MILLENNIUM_PIN, snapshot.os) : null;
  const queuedTags = new Set(
    getPendingSteamActions().flatMap((a) =>
      a.kind === 'millennium-activate' ? [a.tag] : []
    )
  );
  const pinAsset = snapshot.release
    ? path.posix.basename(snapshot.release.asset.url)
    : null;
  const prunes: [string, (entry: string) => boolean][] = [
    [stagingRoot(), (entry) => entry === pinTag || queuedTags.has(entry)],
    [downloadsDir(), (entry) => entry === pinAsset],
  ];
  for (const [dir, keep] of prunes) {
    try {
      pruneDir(dir, keep);
    } catch (error) {
      // A file still locked (e.g. by an AV scan) goes on the next start.
      console.warn('[Millennium] Orphan cleanup failed:', error);
    }
  }
}

function maintainInstall(snapshot: HostSnapshot): void {
  const host = hostTarget(snapshot);
  const record = host?.target.record;
  if (!host || !record) {
    return;
  }
  const target = { ...host.target, record };
  if (host.driver.startupMaintenance(target, isQueued('activate'))) {
    deleteInstallRecord(recordPathIn(target.paths.root));
    resetHostFacts();
    resetMillenniumDetectCache();
  }
}

export function startMillenniumInstall(): void {
  // The queue can apply an item long after the IPC call that queued it, so the UI needs its own push.
  onPendingSteamActionsChanged(() => void publishPluginHostState());
  void (async () => {
    try {
      const snapshot = await getHostSnapshot();
      cleanupOrphans(snapshot);
      maintainInstall(snapshot);
    } catch (error) {
      console.warn('[Millennium] Startup maintenance failed:', error);
    }
    await publishPluginHostState();
  })();
}
