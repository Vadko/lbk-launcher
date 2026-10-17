import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { BrowserWindow } from 'electron';
import {
  downloadsDir,
  getLastMillenniumApplyReport,
  isStagingReady,
  markStagingReady,
  setMillenniumPhaseListener,
  setMillenniumStateListener,
  stagingDirFor,
  stagingRoot,
} from '@/main/millennium-install/apply';
import {
  extractMillenniumArchive,
  missingFiles,
} from '@/main/millennium-install/extract';
import { downloadVerified, MillenniumFetchError } from '@/main/millennium-install/fetch';
import {
  environHasRuntimePath,
  isTakenOver,
  LINUX_RUNTIME_FILES,
  LINUX_RUNTIME_LIB,
  LINUX_STAGED_SUBDIR,
  linksIntact,
  materializeLinuxRuntime,
  planLinuxLinks,
  pruneRuntimeVersions,
  readLinkEntry,
  versionDirComplete,
} from '@/main/millennium-install/linux';
import {
  findMacBundleRoot,
  macWrapperIntact,
  verifyMacBundle,
} from '@/main/millennium-install/macos';
import { deleteInstallRecord, recordPathIn } from '@/main/millennium-install/record';
import { MILLENNIUM_PIN, pinnedTagFor } from '@/main/millennium-install/release';
import {
  missingWindowsFiles,
  probeSteamRootWritable,
  readMillenniumDllVersion,
  WINDOWS_EXPECTED_FILES,
  windowsLoaderState,
} from '@/main/millennium-install/windows';
import {
  deckyLoaderStateFor,
  deckyStateFor,
  getHostSnapshot,
  type HostSnapshot,
  pendingMillenniumAction,
  resetHostFacts,
} from '@/main/plugin-host/state';
import {
  getPendingSteamActions,
  queueSteamAction,
  runPendingSteamActions,
} from '@/main/steam-pending-actions';
import { restartSteamOrchestrated } from '@/main/steam-restart';
import { resetMillenniumDetectCache } from '@/main/utils/millennium';
import { isGamescopeSession } from '@/main/utils/platform';
import { refreshSteamBridgeStatus } from '@/main/utils/steam-bridge';
import {
  findSteamPids,
  isSteamElevated,
  readSteamEnvirons,
  steamMapsContain,
} from '@/main/utils/steam-process';
import { getMainWindow } from '@/main/window';
import type {
  MillenniumInstallResult,
  MillenniumProgress,
  PluginHostState,
} from '@/shared/types';

const execFileAsync = promisify(execFile);

let busy = false;
let prepared: { tag: string } | null = null;
let abort: AbortController | null = null;
let pushWindow: BrowserWindow | null = null;

function targetWindow(): BrowserWindow | null {
  const win = pushWindow && !pushWindow.isDestroyed() ? pushWindow : getMainWindow();
  return win && !win.isDestroyed() ? win : null;
}

function progress(p: MillenniumProgress): void {
  targetWindow()?.webContents.send('millennium:progress', p);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function needsRepair(snapshot: HostSnapshot): boolean {
  const { record, paths, facts } = snapshot;
  if (!record || !paths || !facts.steamPath) {
    return false;
  }
  if (record.os === 'windows') {
    return missingWindowsFiles(facts.steamPath).length > 0;
  }
  if (record.os === 'linux' && paths.linux) {
    return (
      !linksIntact(paths.linux.steamHome, paths.linux.current) ||
      !versionDirComplete(paths.linux.current)
    );
  }
  if (record.os === 'macos' && paths.macos) {
    return !macWrapperIntact(
      record.appBundle ?? paths.macos.appBundle,
      paths.macos.current
    );
  }
  return false;
}

export async function getPluginHostState(): Promise<PluginHostState> {
  const snapshot = await getHostSnapshot();
  const steamRunning = (await findSteamPids()).length > 0;
  const elevated = steamRunning ? await isSteamElevated() : false;
  const { record, release, facts } = snapshot;

  let installed: PluginHostState['millennium']['installed'] = null;
  if (record) {
    installed = {
      managedBy: 'lbk',
      version:
        record.os === 'windows' && facts.steamPath
          ? (readMillenniumDllVersion(facts.steamPath) ?? record.version)
          : record.version,
      mode: record.mode,
      needsRepair: needsRepair(snapshot),
    };
  } else if (facts.millenniumGeneration !== null || facts.linux?.systemMillennium) {
    installed = { managedBy: 'external', version: null, mode: null, needsRepair: false };
  }

  // Windows Millennium updates itself; elsewhere LBK offers the newer pin.
  const update =
    record && record.os !== 'windows' && release && record.tag !== release.tag
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
    targetWindow()?.webContents.send('plugin-host:state-changed', state);
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

async function stripQuarantine(dir: string): Promise<void> {
  try {
    await execFileAsync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', dir], {
      timeout: 30000,
    });
  } catch {
    // xattr exits non-zero when nothing carried the attribute.
  }
}

function checkConflict(snapshot: HostSnapshot): string | null {
  const { facts, paths } = snapshot;
  // Our own record means a loader without its library is a damaged install, not another mod.
  if (snapshot.os === 'windows' && facts.steamPath) {
    return !snapshot.record && windowsLoaderState(facts.steamPath) === 'conflict'
      ? 'wsock32.dll'
      : null;
  }
  if (snapshot.os === 'linux' && paths?.linux) {
    const linux = paths.linux;
    const plan = planLinuxLinks(linux.steamHome, linux.current, (rel) =>
      readLinkEntry(path.posix.join(linux.steamHome, rel))
    );
    return plan.ok ? null : plan.conflict;
  }
  return null;
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
  await downloadVerified(release.asset, archive, {
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
    return fail('extract-failed', describe(error));
  }

  if (snapshot.os === 'windows') {
    const missing = missingFiles(staging, WINDOWS_EXPECTED_FILES);
    if (missing.length > 0) {
      return fail('av-blocked', missing.join(', '));
    }
  } else if (snapshot.os === 'linux' && snapshot.paths?.linux) {
    const missing = missingFiles(
      staging,
      LINUX_RUNTIME_FILES.map((file) => `${LINUX_STAGED_SUBDIR}/${file}`)
    );
    if (missing.length > 0) {
      return fail('av-blocked', missing.join(', '));
    }
    materializeLinuxRuntime(staging, snapshot.paths.linux.runtimeRoot, release.version);
  } else if (snapshot.os === 'macos') {
    const bundleRoot = findMacBundleRoot(staging);
    if (!bundleRoot || !snapshot.hwArch) {
      return fail('extract-failed', 'release bundle not found');
    }
    const verified = verifyMacBundle(bundleRoot, snapshot.hwArch);
    if (!verified.ok) {
      return fail('checksum-mismatch', verified.error);
    }
    await stripQuarantine(staging);
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
    if (
      snapshot.os === 'windows' &&
      snapshot.facts.steamPath &&
      !probeSteamRootWritable(snapshot.facts.steamPath)
    ) {
      return fail('not-writable');
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
    if (error instanceof MillenniumFetchError) {
      console.warn(`[Millennium] Download ${error.kind}: ${error.message}`);
      return fail(error.kind, error.message);
    }
    console.error('[Millennium] Prepare failed:', error);
    return fail('extract-failed', describe(error));
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

function appliedSince(kind: 'activate' | 'deactivate', since: number) {
  const report = getLastMillenniumApplyReport();
  return report && report.kind === kind && report.at >= since ? report : null;
}

async function linuxDiagnostics(): Promise<MillenniumInstallResult['diagnostics']> {
  const environs = await readSteamEnvirons();
  const mapped = await steamMapsContain(LINUX_RUNTIME_LIB);
  return {
    ...(environs ? { steamEnvMissing: !environs.some(environHasRuntimePath) } : {}),
    ...(mapped === null ? {} : { mappedInSteam: mapped }),
  };
}

function outcomeFailure(
  kind: 'activate' | 'deactivate',
  since: number
): MillenniumInstallResult | null {
  const report = appliedSince(kind, since);
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
  const since = Date.now();
  let restarting = false;
  setMillenniumPhaseListener((phase) => {
    if (phase === 'install-files') {
      progress({ phase: 'install-files' });
    } else if (restarting) {
      progress({ phase: 'start-steam' });
    }
  });
  try {
    if ((await findSteamPids()).length === 0) {
      await runPendingSteamActions('manual');
      return outcomeFailure(kind, since) ?? { success: true, bridge: 'unknown' };
    }
    if (restart === 'on-exit') {
      return { success: true, queued: true };
    }

    restarting = true;
    progress({ phase: 'stop-steam' });
    const result = await restartSteamOrchestrated({ verifyBridge: kind === 'activate' });
    if (!result.success) {
      return {
        success: false,
        reason: 'restart-failed',
        restartReason: result.reason,
        queued: isQueued(kind),
        error: result.error,
      };
    }
    const failure = outcomeFailure(kind, since);
    if (failure) {
      return failure;
    }
    if (kind === 'deactivate') {
      return { success: true };
    }
    return verifyActivation(result.bridge ?? 'unknown');
  } finally {
    setMillenniumPhaseListener(null);
  }
}

async function verifyActivation(
  bridge: NonNullable<MillenniumInstallResult['bridge']>
): Promise<MillenniumInstallResult> {
  progress({ phase: 'wait-plugin' });
  const snapshot = await getHostSnapshot();
  // Defender may quarantine the DLLs on their first load.
  if (snapshot.os === 'windows' && snapshot.facts.steamPath) {
    const missing = missingWindowsFiles(snapshot.facts.steamPath);
    if (missing.length > 0) {
      return {
        success: false,
        reason: 'av-blocked',
        bridge,
        diagnostics: { filesPresent: false },
        error: missing.join(', '),
      };
    }
  }
  if (bridge !== 'ready' && snapshot.os === 'linux') {
    return { success: true, bridge, diagnostics: await linuxDiagnostics() };
  }
  return { success: true, bridge };
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
    return fail('script-failed', describe(error));
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
    return fail('script-failed', describe(error));
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
  try {
    for (const entry of fs.readdirSync(stagingRoot())) {
      if (entry !== pinTag && !queuedTags.has(entry)) {
        fs.rmSync(path.join(stagingRoot(), entry), { recursive: true, force: true });
      }
    }
  } catch {
    // No staging dir yet.
  }
  const pinAsset = snapshot.release
    ? path.posix.basename(snapshot.release.asset.url)
    : null;
  try {
    for (const entry of fs.readdirSync(downloadsDir())) {
      if (entry !== pinAsset) {
        fs.rmSync(path.join(downloadsDir(), entry), { recursive: true, force: true });
      }
    }
  } catch {
    // No downloads yet.
  }
}

function realpathOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

// The official installer replaced our links; our env var would keep loading the stale runtime.
function applyLinuxTakeover(snapshot: HostSnapshot): boolean {
  const linux = snapshot.paths?.linux;
  if (snapshot.os !== 'linux' || !snapshot.record || !linux || !snapshot.paths) {
    return false;
  }
  const target = realpathOrNull(
    path.posix.join(linux.steamHome, 'ubuntu12_32/libXtst.so.6')
  );
  // Our own link resolves through any symlinked part of $HOME, so compare against both spellings.
  const roots = [linux.runtimeRoot, realpathOrNull(linux.runtimeRoot)].filter(
    (root): root is string => root !== null
  );
  if (!isTakenOver(target, roots)) {
    return false;
  }
  console.warn(`[Millennium] ${target} is managed elsewhere now, dropping LBK's runtime`);
  fs.rmSync(snapshot.record.envFile ?? linux.envFile, { force: true });
  fs.rmSync(linux.runtimeRoot, { recursive: true, force: true });
  deleteInstallRecord(recordPathIn(snapshot.paths.root));
  return true;
}

function pruneLinuxRuntime(snapshot: HostSnapshot): void {
  const linux = snapshot.paths?.linux;
  if (snapshot.os !== 'linux' || !linux) {
    return;
  }
  const keep = new Set<string>();
  if (snapshot.record) {
    keep.add(snapshot.record.version);
  }
  if (isQueued('activate') && MILLENNIUM_PIN.linux) {
    keep.add(MILLENNIUM_PIN.linux.version);
  }
  pruneRuntimeVersions(linux.runtimeRoot, keep);
}

export function startMillenniumInstall(win: BrowserWindow | null): void {
  pushWindow = win;
  setMillenniumStateListener(() => void publishPluginHostState());
  void (async () => {
    try {
      const snapshot = await getHostSnapshot();
      cleanupOrphans(snapshot);
      if (applyLinuxTakeover(snapshot)) {
        resetHostFacts();
        resetMillenniumDetectCache();
      } else {
        pruneLinuxRuntime(snapshot);
      }
    } catch (error) {
      console.warn('[Millennium] Startup maintenance failed:', error);
    }
    await publishPluginHostState();
  })();
}
