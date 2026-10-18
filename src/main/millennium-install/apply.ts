import * as fs from 'node:fs';
import * as path from 'node:path';
import { BRIDGE_PLUGIN_NAME } from '@lbk/bridge-core/contract';
import { app } from 'electron';
import { appEvents } from '@/main/app-events';
import { getSteamPath } from '@/main/game-detector/steam';
import { resetHostFacts } from '@/main/plugin-host/state';
import { replaceSymlinkAtomic, writeFileAtomic } from '@/main/utils/atomic-write';
import {
  restoreCefFlagFileAfterMillennium,
  syncBridgePluginSetup,
} from '@/main/utils/cef-flag-file';
import {
  renderInitialMillenniumConfig,
  resetMillenniumDetectCache,
} from '@/main/utils/millennium';
import { getPlatform } from '@/main/utils/platform';
import { errnoCode, errorMessage } from '@/shared/errors';
import type { MillenniumFailure } from '@/shared/plugin-host-types';
import {
  applyLinuxLinks,
  LINUX_RUNTIME_LIB,
  materializeLinuxRuntime,
  planLinuxLinks,
  pruneRuntimeVersions,
  readLinkEntry,
  removeLinuxLinks,
  writeEnvironmentFile,
} from './linux';
import { applyMacActivation, findMacBundleRoot } from './macos';
import { installPathsFor, MAC_WRAPPER_APP, type MillenniumInstallPaths } from './paths';
import {
  deleteInstallRecord,
  type MillenniumInstallRecord,
  managedByFor,
  readInstallRecord,
  recordPathIn,
  writeInstallRecord,
} from './record';
import { MILLENNIUM_PIN, type MillenniumOs, pinnedTagFor } from './release';
import {
  applyWindowsActivation,
  applyWindowsRemoval,
  windowsLoaderState,
} from './windows';

export type QueuedMillenniumAction =
  | { kind: 'millennium-activate'; tag: string }
  | { kind: 'millennium-deactivate'; purge: boolean };

// 'retry' keeps the item and counts an attempt; 'drop' removes it.
type ApplyOutcome = 'applied' | 'retry' | 'drop';

export interface MillenniumApplyReport {
  kind: 'activate' | 'deactivate';
  outcome: ApplyOutcome;
  reason?: MillenniumFailure;
  error?: string;
}

const READY_MARKER = '.lbk-ready';
const LOCKED_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

const millenniumWorkDir = (): string => path.join(app.getPath('userData'), 'millennium');

export function stagingRoot(): string {
  return path.join(millenniumWorkDir(), 'staging');
}

export function downloadsDir(): string {
  return path.join(millenniumWorkDir(), 'downloads');
}

// Tags come from the compiled-in pin, never from the renderer-writable queue alone.
export function stagingDirFor(tag: string): string {
  return path.join(stagingRoot(), tag.replace(/[^\w.-]/g, '_'));
}

export function markStagingReady(tag: string): void {
  fs.writeFileSync(path.join(stagingDirFor(tag), READY_MARKER), new Date().toISOString());
}

export function isStagingReady(tag: string): boolean {
  return fs.existsSync(path.join(stagingDirFor(tag), READY_MARKER));
}

function currentOs(): MillenniumOs | null {
  const platform = getPlatform();
  return platform === 'unknown' ? null : platform;
}

function currentRecord(): {
  os: MillenniumOs;
  steamPath: string;
  paths: MillenniumInstallPaths;
  record: MillenniumInstallRecord | null;
} | null {
  const platform = currentOs();
  const steamPath = getSteamPath();
  if (!platform || !steamPath) {
    return null;
  }
  const paths = installPathsFor(platform, steamPath);
  const record = readInstallRecord(recordPathIn(paths.root));
  return {
    os: platform,
    steamPath,
    paths,
    record: managedByFor(record, platform, steamPath) === 'lbk' ? record : null,
  };
}

export function millenniumQueueContext(): {
  pinTag: string | null;
  stagingReady: (tag: string) => boolean;
  recordPresent: boolean;
} {
  const platform = currentOs();
  return {
    pinTag: platform ? pinnedTagFor(MILLENNIUM_PIN, platform) : null,
    stagingReady: isStagingReady,
    recordPresent: currentRecord()?.record != null,
  };
}

function ensureInitialConfig(configPath: string, lbkManagesUpdates: boolean): void {
  if (fs.existsSync(configPath)) {
    return;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileAtomic(
    configPath,
    renderInitialMillenniumConfig(BRIDGE_PLUGIN_NAME, lbkManagesUpdates)
  );
}

class ApplyRefusal extends Error {
  constructor(
    readonly reason: MillenniumFailure,
    message: string
  ) {
    super(message);
  }
}

function mergeBackups(
  previous: readonly { link: string; backup: string }[],
  next: readonly { link: string; backup: string }[]
): { link: string; backup: string }[] {
  return [...previous.filter((b) => !next.some((n) => n.link === b.link)), ...next];
}

// `commit` writes the record before the first change that would make the install look foreign without it.
function activateFiles(
  ctx: NonNullable<ReturnType<typeof currentRecord>>,
  tag: string,
  commit: (record: MillenniumInstallRecord) => void
): MillenniumInstallRecord {
  const staging = stagingDirFor(tag);
  const base = {
    format: 1 as const,
    tag,
    activatedAt: new Date().toISOString(),
    steamPath: ctx.steamPath,
    xtstBackups: ctx.record?.xtstBackups ?? [],
  };

  if (ctx.os === 'windows') {
    const release = MILLENNIUM_PIN.windows;
    if (!release) {
      throw new ApplyRefusal('unsupported', 'no Windows pin');
    }
    if (!ctx.record && windowsLoaderState(ctx.steamPath) === 'conflict') {
      throw new ApplyRefusal('conflict', 'foreign wsock32.dll');
    }
    const record: MillenniumInstallRecord = {
      ...base,
      os: 'windows',
      mode: 'windows',
      version: release.version,
    };
    applyWindowsActivation(staging, ctx.steamPath, {
      skip: new Set([READY_MARKER]),
      beforeLoader: () => commit(record),
    });
    ensureInitialConfig(ctx.paths.configPath, false);
    return record;
  }

  if (ctx.os === 'linux') {
    const release = MILLENNIUM_PIN.linux;
    const linux = ctx.paths.linux;
    if (!release || !linux) {
      throw new ApplyRefusal('unsupported', 'no Linux pin');
    }
    const plan = planLinuxLinks(linux.steamHome, linux.current, (rel) =>
      readLinkEntry(path.posix.join(linux.steamHome, rel))
    );
    if (!plan.ok) {
      throw new ApplyRefusal('conflict', `foreign ${plan.conflict}`);
    }
    const versionDir = materializeLinuxRuntime(
      staging,
      linux.runtimeRoot,
      release.version
    );
    // Flipping `current` is what an update amounts to; the links below already point through it.
    replaceSymlinkAtomic(versionDir, linux.current);
    const planned = plan.steps.flatMap((step) =>
      step.backup ? [{ link: step.link, backup: step.backup }] : []
    );
    const record: MillenniumInstallRecord = {
      ...base,
      os: 'linux',
      mode: 'linux-user',
      version: release.version,
      // Listed before the rename: uninstall restores a backup only where the link is gone and the backup exists.
      xtstBackups: mergeBackups(base.xtstBackups, planned),
      runtimeDir: versionDir,
      envFile: linux.envFile,
    };
    commit(record);
    writeEnvironmentFile(
      linux.envFile,
      path.posix.join(linux.current, LINUX_RUNTIME_LIB)
    );
    fs.mkdirSync(ctx.paths.root, { recursive: true });
    ensureInitialConfig(ctx.paths.configPath, true);
    applyLinuxLinks(plan.steps);
    try {
      pruneRuntimeVersions(linux.runtimeRoot, new Set([release.version]));
    } catch (error) {
      console.warn('[Millennium] Old runtime cleanup failed:', error);
    }
    return record;
  }

  const release = MILLENNIUM_PIN.macos;
  const mac = ctx.paths.macos;
  const bundleRoot = fs.existsSync(staging) ? findMacBundleRoot(staging) : null;
  if (!release || !mac || !bundleRoot) {
    throw new ApplyRefusal('not-prepared', 'staged macOS bundle missing');
  }
  const appBundle = ctx.record?.appBundle ?? mac.appBundle;
  if (path.posix.basename(appBundle) !== MAC_WRAPPER_APP) {
    throw new ApplyRefusal('conflict', `unexpected wrapper path ${appBundle}`);
  }
  const record: MillenniumInstallRecord = {
    ...base,
    os: 'macos',
    mode: 'macos-wrapper',
    version: release.version,
    runtimeDir: path.posix.join(mac.runtimeRoot, release.version),
    appBundle,
  };
  commit(record);
  applyMacActivation({
    bundleRoot,
    version: release.version,
    runtimeRoot: mac.runtimeRoot,
    runtimeCurrent: mac.current,
    appBundle,
  });
  fs.mkdirSync(ctx.paths.pluginsDir, { recursive: true });
  ensureInitialConfig(ctx.paths.configPath, true);
  return record;
}

function removeFiles(
  ctx: NonNullable<ReturnType<typeof currentRecord>>,
  record: MillenniumInstallRecord,
  purge: boolean
): void {
  const pluginDir = path.join(ctx.paths.pluginsDir, BRIDGE_PLUGIN_NAME);
  if (ctx.os === 'windows') {
    applyWindowsRemoval(ctx.steamPath, purge, 'millennium/plugins/lbk-bridge');
  } else if (ctx.os === 'linux' && ctx.paths.linux) {
    const linux = ctx.paths.linux;
    removeLinuxLinks(linux.steamHome, linux.runtimeRoot, record.xtstBackups);
    fs.rmSync(record.envFile ?? linux.envFile, { force: true });
    fs.rmSync(linux.runtimeRoot, { recursive: true, force: true });
  } else if (ctx.os === 'macos' && ctx.paths.macos) {
    const mac = ctx.paths.macos;
    const appBundle = record.appBundle ?? mac.appBundle;
    if (path.posix.basename(appBundle) === MAC_WRAPPER_APP) {
      fs.rmSync(appBundle, { recursive: true, force: true });
    }
    fs.rmSync(mac.runtimeRoot, { recursive: true, force: true });
    fs.rmSync(mac.steamuiMillennium, { recursive: true, force: true });
  }
  fs.rmSync(pluginDir, { recursive: true, force: true });
  if (purge) {
    for (const dir of [ctx.paths.root, ...ctx.paths.purgeDirs]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  deleteInstallRecord(recordPathIn(ctx.paths.root));
}

function afterChange(): void {
  resetMillenniumDetectCache();
  resetHostFacts();
}

function report(
  kind: MillenniumApplyReport['kind'],
  outcome: ApplyOutcome,
  reason?: MillenniumFailure,
  error?: string
): MillenniumApplyReport {
  return { kind, outcome, reason, error };
}

function failureFor(error: unknown): {
  outcome: ApplyOutcome;
  reason: MillenniumFailure;
} {
  if (error instanceof ApplyRefusal) {
    return { outcome: 'drop', reason: error.reason };
  }
  const code = errnoCode(error);
  if (typeof code === 'string' && LOCKED_CODES.has(code)) {
    // Windows helpers can hold DLLs for a moment after Steam's main process is gone.
    return getPlatform() === 'windows'
      ? { outcome: 'retry', reason: 'files-locked' }
      : { outcome: 'drop', reason: 'not-writable' };
  }
  return { outcome: 'drop', reason: 'script-failed' };
}

// Runs only from the pending-actions queue with Steam confirmed off.
export function applyQueuedMillenniumAction(
  action: QueuedMillenniumAction
): MillenniumApplyReport {
  const kind = action.kind === 'millennium-activate' ? 'activate' : 'deactivate';
  const ctx = currentRecord();
  if (!ctx) {
    return report(kind, 'drop', 'unsupported', 'Steam not found');
  }
  try {
    if (action.kind === 'millennium-activate') {
      appEvents.emit('millennium-phase', 'install-files');
      const recordPath = recordPathIn(ctx.paths.root);
      const record = activateFiles(ctx, action.tag, (r) =>
        writeInstallRecord(recordPath, r)
      );
      writeInstallRecord(recordPath, record);
      afterChange();
      syncBridgePluginSetup();
      fs.rmSync(stagingDirFor(action.tag), { recursive: true, force: true });
      fs.rmSync(downloadsDir(), { recursive: true, force: true });
      console.log(`[Millennium] Activated ${record.version} (${record.mode})`);
    } else {
      if (!ctx.record) {
        return report(kind, 'drop', 'unsupported', 'not installed by LBK');
      }
      appEvents.emit('millennium-phase', 'install-files');
      removeFiles(ctx, ctx.record, action.purge);
      afterChange();
      restoreCefFlagFileAfterMillennium();
      console.log(`[Millennium] Removed${action.purge ? ' with data' : ''}`);
    }
    appEvents.emit('millennium-phase', 'installed');
    return report(kind, 'applied');
  } catch (error) {
    const failure = failureFor(error);
    const message = errorMessage(error);
    if (failure.outcome === 'retry' || error instanceof ApplyRefusal) {
      console.warn(`[Millennium] ${kind} ${failure.reason}: ${message}`);
    } else {
      console.error(`[Millennium] ${kind} failed:`, error);
    }
    afterChange();
    return report(kind, failure.outcome, failure.reason, message);
  }
}
