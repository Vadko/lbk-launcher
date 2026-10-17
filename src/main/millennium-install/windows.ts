import * as fs from 'node:fs';
import * as path from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import { coerce } from 'semver';

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

export type FileId = { ino: bigint; dev: bigint } | null;

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

export function isSameFile(a: FileId, b: FileId): boolean {
  return a !== null && b !== null && a.ino === b.ino && a.dev === b.dev;
}

// Loader first, so a crash mid-removal leaves Millennium inert rather than half-loaded.
export function planWindowsRemoval(i: {
  hhx64: FileId;
  versionDlls: { rel: string; id: FileId }[];
  purge: boolean;
  pluginDirRel: string;
}): RemovalStep[] {
  const steps: RemovalStep[] = [{ kind: 'file', rel: WINDOWS_LOADER }];
  for (const dll of i.versionDlls) {
    if (isSameFile(dll.id, i.hhx64)) {
      steps.push({ kind: 'file', rel: dll.rel });
    }
  }
  for (const dir of REMOVED_DIRS) {
    steps.push({ kind: 'dir', rel: dir });
  }
  steps.push({ kind: 'dir', rel: i.purge ? 'millennium' : i.pluginDirRel });
  return steps;
}

function fileId(p: string): FileId {
  try {
    const st = fs.statSync(p, { bigint: true });
    return { ino: st.ino, dev: st.dev };
  } catch {
    return null;
  }
}

export function windowsLoaderState(steamPath: string): 'ok' | 'conflict' {
  return classifyWindowsLoader({
    loader: fs.existsSync(path.join(steamPath, WINDOWS_LOADER)),
    millenniumLib: fs.existsSync(path.join(steamPath, MILLENNIUM_LIB)),
  });
}

export function probeSteamRootWritable(steamPath: string): boolean {
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
    const target = path.join(steamPath, rel);
    const tmp = `${target}.lbk.tmp`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(stagingDir, rel), tmp);
    try {
      fs.renameSync(tmp, target);
    } catch (error) {
      fs.rmSync(tmp, { force: true });
      throw error;
    }
  }
}

export function applyWindowsRemoval(
  steamPath: string,
  purge: boolean,
  pluginDirRel: string
): void {
  const steps = planWindowsRemoval({
    hhx64: fileId(path.join(steamPath, HHX64)),
    versionDlls: CEF_VERSION_DLLS.map((rel) => ({
      rel,
      id: fileId(path.join(steamPath, rel)),
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

export function missingWindowsFiles(steamPath: string): string[] {
  return WINDOWS_EXPECTED_FILES.filter(
    (rel) => !fs.existsSync(path.join(steamPath, rel))
  );
}

let dllVersionCache: { key: string; version: string | null } | null = null;

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
  if (dllVersionCache?.key === key) {
    return dllVersionCache.version;
  }
  let version: string | null = null;
  try {
    const exe = NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
    const [info] = Resource.VersionInfo.fromEntries(
      NtExecutableResource.from(exe).entries
    );
    const raw = info
      ?.getAllLanguagesForStringValues()
      .map((lang) => info.getStringValues(lang).FileVersion)
      .find(Boolean);
    version = coerce(raw ?? null)?.version ?? null;
  } catch (error) {
    console.warn('[Millennium] Cannot read the millennium.dll version:', error);
  }
  dllVersionCache = { key, version };
  return version;
}
