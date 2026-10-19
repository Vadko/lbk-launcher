import * as fs from 'node:fs';
import * as path from 'node:path';
import { BRIDGE_PLUGIN_NAME } from '@lbk/bridge-core/contract';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { renderInitialMillenniumConfig } from '@/main/utils/millennium';
import type {
  MillenniumFailure,
  MillenniumInstallResult,
} from '@/shared/plugin-host-types';
import type { MillenniumInstallPaths } from './paths';
import type { MillenniumInstallRecord } from './record';
import type { MacHardwareArch } from './release';

export const STAGING_READY_MARKER = '.lbk-ready';

export class ApplyRefusal extends Error {
  constructor(
    readonly reason: MillenniumFailure,
    message: string
  ) {
    super(message);
  }
}

export function ensureInitialConfig(
  configPath: string,
  lbkManagesUpdates: boolean
): void {
  if (fs.existsSync(configPath)) {
    return;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileAtomic(
    configPath,
    renderInitialMillenniumConfig(BRIDGE_PLUGIN_NAME, lbkManagesUpdates)
  );
}

type RecordBase = Pick<
  MillenniumInstallRecord,
  'format' | 'tag' | 'activatedAt' | 'steamPath' | 'xtstBackups'
>;

export interface InstallTarget {
  steamPath: string;
  paths: MillenniumInstallPaths;
  // LBK's own record for this Steam; null when the files are not ours.
  record: MillenniumInstallRecord | null;
}

export type InstalledTarget = InstallTarget & { record: MillenniumInstallRecord };

type BridgeVerdict = NonNullable<MillenniumInstallResult['bridge']>;

// The per-OS half of installing Millennium; millennium-install.ts and apply.ts hold the shared flow.
export interface MillenniumOsDriver {
  // Windows Millennium updates itself in place; elsewhere LBK offers the newer pin.
  offersUpdates: boolean;
  // Windows helpers can hold DLLs for a moment after Steam's main process is gone.
  retriesLockedFiles: boolean;
  installedVersion(target: InstalledTarget): string;
  needsRepair(target: InstalledTarget): boolean;
  // Another mod in the way; LBK never installs over it.
  conflict(target: InstallTarget): string | null;
  preflight(target: InstallTarget): MillenniumFailure | null;
  checkStaged(
    target: InstallTarget,
    staged: { dir: string; version: string; hwArch: MacHardwareArch | null }
  ): Promise<{ reason: MillenniumFailure; error?: string } | null>;
  // `commit` writes the record before the first change that would make the install look foreign without it.
  activate(
    target: InstallTarget,
    i: {
      staging: string;
      base: RecordBase;
      commit: (record: MillenniumInstallRecord) => void;
    }
  ): MillenniumInstallRecord;
  remove(target: InstalledTarget, purge: boolean): void;
  verifyActivated(
    target: InstallTarget,
    bridge: BridgeVerdict
  ): Promise<MillenniumInstallResult>;
  // Startup only; true when it changed what is installed.
  startupMaintenance(target: InstalledTarget, activationQueued: boolean): boolean;
}
