import * as fs from 'node:fs';
import * as path from 'node:path';
import { LRUCache } from 'lru-cache';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { coerce } from 'semver';
import { copyFileAtomic } from '@/main/utils/atomic-write';
import { isSameFile, missingFiles } from '@/main/utils/fs-safe';
import {
  ApplyRefusal,
  ensureInitialConfig,
  type MillenniumOsDriver,
  STAGING_READY_MARKER,
} from './driver';
import type { MillenniumInstallRecord } from './record';
import { MILLENNIUM_PIN } from './release';

const WINDOWS_LOADER = 'wsock32.dll';
export const WINDOWS_EXPECTED_FILES = [
  WINDOWS_LOADER,
  'millennium/lib/millennium.dll',
  'millennium/lib/millennium.hhx64.dll',
  'millennium/bin/millennium.crashhandler64.exe',
  'millennium/bin/millennium.luavm64.exe',
] as const;
const MILLENNIUM_LIB = 'millennium/lib/millennium.dll';
const HHX64 = 'millennium/lib/millennium.hhx64.dll';
// Millennium hardlinks its hook into CEF on first start.
const CEF_VERSION_DLLS = [
  'bin/cef/cef.win64/version.dll',
  'bin/cef/cef.win7x64/version.dll',
];
const REMOVED_DIRS = [
  'millennium/lib',
  'millennium/bin',
  'millennium/ext',
  'millennium-updater-temp-files',
  'millennium-migration-temp',
];

export type RemovalStep = { kind: 'file' | 'dir'; rel: string };

// The loader goes last: until it exists every other Millennium file is inert.
export function planWindowsActivation(stagedRel: readonly string[]): string[] {
  const norm = stagedRel.map((rel) => rel.replace(/\\/g, '/'));
  const rest = norm.filter((rel) => rel.toLowerCase() !== WINDOWS_LOADER).sort();
  return norm.some((rel) => rel.toLowerCase() === WINDOWS_LOADER)
    ? [...rest, WINDOWS_LOADER]
    : rest;
}

// DLL-proxy mods ship a wsock32.dll too; without Millennium's own library next to it the file is not ours.
export function classifyWindowsLoader(present: {
  loader: boolean;
  millenniumLib: boolean;
}): 'ok' | 'conflict' {
  return present.loader && !present.millenniumLib ? 'conflict' : 'ok';
}

// Loader first, so a crash mid-removal leaves Millennium inert rather than half-loaded.
export function planWindowsRemoval(i: {
  versionDlls: { rel: string; linkedToHook: boolean }[];
  purge: boolean;
  pluginDirRel: string;
}): RemovalStep[] {
  const steps: RemovalStep[] = [{ kind: 'file', rel: WINDOWS_LOADER }];
  for (const dll of i.versionDlls) {
    if (dll.linkedToHook) {
      steps.push({ kind: 'file', rel: dll.rel });
    }
  }
  for (const dir of REMOVED_DIRS) {
    steps.push({ kind: 'dir', rel: dir });
  }
  steps.push({ kind: 'dir', rel: i.purge ? 'millennium' : i.pluginDirRel });
  return steps;
}

function windowsLoaderState(steamPath: string): 'ok' | 'conflict' {
  return classifyWindowsLoader({
    loader: fs.existsSync(path.join(steamPath, WINDOWS_LOADER)),
    millenniumLib: fs.existsSync(path.join(steamPath, MILLENNIUM_LIB)),
  });
}

function probeSteamRootWritable(steamPath: string): boolean {
  const probe = path.join(steamPath, '.lbk-write-probe');
  try {
    fs.writeFileSync(probe, '');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

function listFiles(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listFiles(root, child));
    } else if (entry.isFile()) {
      out.push(child);
    }
  }
  return out;
}

// Steam must be off; EBUSY/EPERM from lingering helpers propagate so the queue keeps the item.
export function applyWindowsActivation(
  stagingDir: string,
  steamPath: string,
  opts: { skip: ReadonlySet<string>; beforeLoader: () => void }
): void {
  const staged = listFiles(stagingDir).filter((rel) => !opts.skip.has(rel));
  for (const rel of planWindowsActivation(staged)) {
    if (rel === WINDOWS_LOADER) {
      opts.beforeLoader();
    }
    copyFileAtomic(path.join(stagingDir, rel), path.join(steamPath, rel));
  }
}

export function applyWindowsRemoval(
  steamPath: string,
  purge: boolean,
  pluginDirRel: string
): void {
  const hook = path.join(steamPath, HHX64);
  const steps = planWindowsRemoval({
    versionDlls: CEF_VERSION_DLLS.map((rel) => ({
      rel,
      linkedToHook: isSameFile(path.join(steamPath, rel), hook),
    })),
    purge,
    pluginDirRel,
  });
  for (const step of steps) {
    fs.rmSync(path.join(steamPath, step.rel), {
      recursive: step.kind === 'dir',
      force: true,
    });
  }
}

function parseDllVersion(file: string): string | null {
  try {
    const exe = NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
    const [info] = Resource.VersionInfo.fromEntries(
      NtExecutableResource.from(exe).entries
    );
    const raw = info
      ?.getAllLanguagesForStringValues()
      .map((lang) => info.getStringValues(lang).FileVersion)
      .find(Boolean);
    return coerce(raw ?? null)?.version ?? null;
  } catch (error) {
    console.warn('[Millennium] Cannot read the millennium.dll version:', error);
    return null;
  }
}

// Keyed by path, size and mtime; boxed because the cache cannot hold null.
const dllVersions = new LRUCache<string, { version: string | null }, string>({
  max: 1,
  memoMethod: (_key, _stale, { context }) => ({ version: parseDllVersion(context) }),
});

// Millennium on Windows updates itself in place, so the version LBK recorded at install goes stale.
export function readMillenniumDllVersion(steamPath: string): string | null {
  const file = path.join(steamPath, MILLENNIUM_LIB);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  const key = `${file}:${stat.size}:${stat.mtimeMs}`;
  return dllVersions.memo(key, { context: file }).version;
}

function missingInstallFiles(root: string): string | null {
  const missing = missingFiles(root, WINDOWS_EXPECTED_FILES);
  return missing.length > 0 ? missing.join(', ') : null;
}

export const windowsDriver: MillenniumOsDriver = {
  offersUpdates: false,
  retriesLockedFiles: true,
  installedVersion: ({ steamPath, record }) =>
    readMillenniumDllVersion(steamPath) ?? record.version,
  needsRepair: ({ steamPath }) => missingInstallFiles(steamPath) !== null,
  // Our own record means a loader without its library is a damaged install, not another mod.
  conflict: ({ steamPath, record }) =>
    !record && windowsLoaderState(steamPath) === 'conflict' ? WINDOWS_LOADER : null,
  preflight: ({ steamPath }) =>
    probeSteamRootWritable(steamPath) ? null : 'not-writable',
  checkStaged: (_target, staged) => {
    const missing = missingInstallFiles(staged.dir);
    return Promise.resolve(missing ? { reason: 'av-blocked', error: missing } : null);
  },
  activate: (target, { staging, base, commit }) => {
    const release = MILLENNIUM_PIN.windows;
    if (!release) {
      throw new ApplyRefusal('unsupported', 'no Windows pin');
    }
    if (windowsDriver.conflict(target)) {
      throw new ApplyRefusal('conflict', `foreign ${WINDOWS_LOADER}`);
    }
    const record: MillenniumInstallRecord = {
      ...base,
      os: 'windows',
      mode: 'windows',
      version: release.version,
    };
    applyWindowsActivation(staging, target.steamPath, {
      skip: new Set([STAGING_READY_MARKER]),
      beforeLoader: () => commit(record),
    });
    ensureInitialConfig(target.paths.configPath, false);
    return record;
  },
  remove: ({ steamPath }, purge) =>
    applyWindowsRemoval(steamPath, purge, 'millennium/plugins/lbk-bridge'),
  // Defender may quarantine the DLLs on their first load.
  verifyActivated: ({ steamPath }, bridge) => {
    const missing = missingInstallFiles(steamPath);
    return Promise.resolve(
      missing
        ? {
            success: false,
            reason: 'av-blocked',
            bridge,
            diagnostics: { filesPresent: false },
            error: missing,
          }
        : { success: true, bridge }
    );
  },
  startupMaintenance: () => false,
};
