import * as fs from 'node:fs';
import * as path from 'node:path';
import { BRIDGE_PLUGIN_NAME } from '@lbk/bridge-core/contract';
import { app } from 'electron';
import { appEvents } from '@/main/app-events';
import { getSteamPath } from '@/main/game-detector/steam';
import { resetHostFacts } from '@/main/plugin-host/state';
import {
  restoreCefFlagFileAfterMillennium,
  syncBridgePluginSetup,
} from '@/main/utils/cef-flag-file';
import { resetMillenniumDetectCache } from '@/main/utils/millennium';
import { getPlatform } from '@/main/utils/platform';
import { errnoCode, errorMessage } from '@/shared/errors';
import type { MillenniumFailure } from '@/shared/plugin-host-types';
import {
  ApplyRefusal,
  type InstalledTarget,
  type InstallTarget,
  type MillenniumOsDriver,
  STAGING_READY_MARKER,
} from './driver';
import { MILLENNIUM_DRIVERS } from './drivers';
import { installPathsFor } from './paths';
import {
  deleteInstallRecord,
  managedByFor,
  readInstallRecord,
  recordPathIn,
  writeInstallRecord,
} from './record';
import { MILLENNIUM_PIN, type MillenniumOs, pinnedTagFor } from './release';

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
  fs.writeFileSync(
    path.join(stagingDirFor(tag), STAGING_READY_MARKER),
    new Date().toISOString()
  );
}

export function isStagingReady(tag: string): boolean {
  return fs.existsSync(path.join(stagingDirFor(tag), STAGING_READY_MARKER));
}

function currentOs(): MillenniumOs | null {
  const platform = getPlatform();
  return platform === 'unknown' ? null : platform;
}

function currentTarget(): { driver: MillenniumOsDriver; target: InstallTarget } | null {
  const platform = currentOs();
  const steamPath = getSteamPath();
  if (!platform || !steamPath) {
    return null;
  }
  const paths = installPathsFor(platform, steamPath);
  const record = readInstallRecord(recordPathIn(paths.root));
  return {
    driver: MILLENNIUM_DRIVERS[platform],
    target: {
      steamPath,
      paths,
      record: managedByFor(record, platform, steamPath) === 'lbk' ? record : null,
    },
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
    recordPresent: currentTarget()?.target.record != null,
  };
}

function removeFiles(
  driver: MillenniumOsDriver,
  target: InstalledTarget,
  purge: boolean
): void {
  driver.remove(target, purge);
  fs.rmSync(path.join(target.paths.pluginsDir, BRIDGE_PLUGIN_NAME), {
    recursive: true,
    force: true,
  });
  if (purge) {
    for (const dir of [target.paths.root, ...target.paths.purgeDirs]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  deleteInstallRecord(recordPathIn(target.paths.root));
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

function failureFor(
  driver: MillenniumOsDriver,
  error: unknown
): {
  outcome: ApplyOutcome;
  reason: MillenniumFailure;
} {
  if (error instanceof ApplyRefusal) {
    return { outcome: 'drop', reason: error.reason };
  }
  const code = errnoCode(error);
  if (typeof code === 'string' && LOCKED_CODES.has(code)) {
    return driver.retriesLockedFiles
      ? { outcome: 'retry', reason: 'files-locked' }
      : { outcome: 'drop', reason: 'not-writable' };
  }
  return { outcome: 'drop', reason: 'script-failed' };
}

// Runs only from the pending-actions queue with Steam confirmed off.
export async function applyQueuedMillenniumAction(
  action: QueuedMillenniumAction
): Promise<MillenniumApplyReport> {
  const kind = action.kind === 'millennium-activate' ? 'activate' : 'deactivate';
  const current = currentTarget();
  if (!current) {
    return report(kind, 'drop', 'unsupported', 'Steam not found');
  }
  const { driver, target } = current;
  try {
    if (action.kind === 'millennium-activate') {
      appEvents.emit('millennium-phase', 'install-files');
      const recordPath = recordPathIn(target.paths.root);
      const record = driver.activate(target, {
        staging: stagingDirFor(action.tag),
        base: {
          format: 1,
          tag: action.tag,
          activatedAt: new Date().toISOString(),
          steamPath: target.steamPath,
          xtstBackups: target.record?.xtstBackups ?? [],
        },
        commit: (r) => writeInstallRecord(recordPath, r),
      });
      writeInstallRecord(recordPath, record);
      afterChange();
      await syncBridgePluginSetup();
      fs.rmSync(stagingDirFor(action.tag), { recursive: true, force: true });
      fs.rmSync(downloadsDir(), { recursive: true, force: true });
      console.log(`[Millennium] Activated ${record.version} (${record.mode})`);
    } else {
      const { record } = target;
      if (!record) {
        return report(kind, 'drop', 'unsupported', 'not installed by LBK');
      }
      appEvents.emit('millennium-phase', 'install-files');
      removeFiles(driver, { ...target, record }, action.purge);
      afterChange();
      restoreCefFlagFileAfterMillennium();
      console.log(`[Millennium] Removed${action.purge ? ' with data' : ''}`);
    }
    appEvents.emit('millennium-phase', 'installed');
    return report(kind, 'applied');
  } catch (error) {
    const failure = failureFor(driver, error);
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
