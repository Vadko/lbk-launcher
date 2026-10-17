import * as fs from 'node:fs';
import * as path from 'node:path';
import { replaceSymlinkAtomic, writeFileAtomic } from '@/main/utils/atomic-write';

export const RUNTIME_PATH_ENV = 'MILLENNIUM_RUNTIME_PATH';
export const LINUX_RUNTIME_LIB = 'libmillennium_x86.so';
export const LINUX_STAGED_SUBDIR = 'usr/lib/millennium';
export const LINUX_RUNTIME_FILES = [
  LINUX_RUNTIME_LIB,
  'libmillennium_bootstrap_x86.so',
  'libmillennium_bootstrap_hhx64.so',
  'libmillennium_hhx64.so',
  'libmillennium_luavm_x86',
  'libmillennium_pvs64',
] as const;
const LINUX_EXECUTABLES: ReadonlySet<string> = new Set([
  'libmillennium_luavm_x86',
  'libmillennium_pvs64',
]);
const LINUX_LINKS = [
  { rel: 'ubuntu12_32/libXtst.so.6', target: 'libmillennium_bootstrap_x86.so' },
  { rel: 'ubuntu12_64/libXtst.so.6', target: 'libmillennium_bootstrap_hhx64.so' },
  { rel: 'ubuntu12_64/libmillennium_hhx64.so', target: 'libmillennium_hhx64.so' },
] as const;
export const LINUX_LINK_RELS: readonly string[] = LINUX_LINKS.map(({ rel }) => rel);
export const LINK_BACKUP_SUFFIX = '.lbk-backup';

export type LinkEntry =
  | { kind: 'missing' }
  | { kind: 'file' }
  | { kind: 'dir' }
  | { kind: 'symlink'; target: string };

export interface LinkStep {
  link: string;
  target: string;
  // Set when a regular file (Valve's own libXtst) is moved aside first.
  backup: string | null;
}

export function isMillenniumLinkTarget(target: string): boolean {
  return target.toLowerCase().includes('millennium');
}

export function planLinuxLinks(
  steamHome: string,
  libDir: string,
  existing: (rel: string) => LinkEntry
): { ok: true; steps: LinkStep[] } | { ok: false; conflict: string } {
  const steps: LinkStep[] = [];
  for (const { rel, target } of LINUX_LINKS) {
    const link = path.posix.join(steamHome, rel);
    const entry = existing(rel);
    if (entry.kind === 'dir') {
      return { ok: false, conflict: link };
    }
    if (entry.kind === 'symlink' && !isMillenniumLinkTarget(entry.target)) {
      return { ok: false, conflict: link };
    }
    steps.push({
      link,
      target: path.posix.join(libDir, target),
      backup: entry.kind === 'file' ? `${link}${LINK_BACKUP_SUFFIX}` : null,
    });
  }
  return { ok: true, steps };
}

export function renderEnvironmentFile(runtimeLib: string): string {
  return `${RUNTIME_PATH_ENV}=${runtimeLib}\n`;
}

const FOREIGN_ABI = /x86-64|x32|aarch64|arm|riscv|ppc|64bit/i;

function hasI386Entry(stdout: string, lib: string): boolean {
  const escaped = lib.replace(/\./g, '\\.');
  const re = new RegExp(`^\\s*${escaped} \\(([^)]*)\\)`, 'gm');
  for (const match of stdout.matchAll(re)) {
    const tags = match[1].split(',').map((tag) => tag.trim());
    if (tags.includes('libc6') && !tags.some((tag) => FOREIGN_ABI.test(tag))) {
      return true;
    }
  }
  return false;
}

// `ldconfig -p` tags 32-bit x86 libraries with a bare "(libc6)".
export function parseLdconfig(stdout: string): boolean {
  return hasI386Entry(stdout, 'libssl.so.3') && hasI386Entry(stdout, 'libcrypto.so.3');
}

// ELFCLASS32 + EM_386.
export function isI386Elf(header: Buffer): boolean {
  return (
    header.length >= 20 &&
    header.readUInt32BE(0) === 0x7f454c46 &&
    header[4] === 1 &&
    header.readUInt16LE(18) === 3
  );
}

export function environHasRuntimePath(environ: Buffer | string): boolean {
  const text = typeof environ === 'string' ? environ : environ.toString('utf8');
  const prefix = `${RUNTIME_PATH_ENV}=`;
  return text
    .split('\0')
    .some((entry) => entry.startsWith(prefix) && entry.length > prefix.length);
}

function isUnder(target: string, root: string): boolean {
  return target.startsWith(root.endsWith('/') ? root : `${root}/`);
}

// The official installer took over: its links resolve outside every spelling of our runtime root.
export function isTakenOver(
  xtstRealTarget: string | null,
  lbkRuntimeRoots: readonly string[]
): boolean {
  if (xtstRealTarget === null || !isMillenniumLinkTarget(xtstRealTarget)) {
    return false;
  }
  return !lbkRuntimeRoots.some((root) => isUnder(xtstRealTarget, root));
}

export function readLinkEntry(p: string): LinkEntry {
  try {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) {
      return { kind: 'symlink', target: fs.readlinkSync(p) };
    }
    return st.isDirectory() ? { kind: 'dir' } : { kind: 'file' };
  } catch {
    return { kind: 'missing' };
  }
}

export function linksIntact(steamHome: string, libDir: string): boolean {
  return LINUX_LINKS.every(({ rel, target }) => {
    const entry = readLinkEntry(path.posix.join(steamHome, rel));
    return entry.kind === 'symlink' && entry.target === path.posix.join(libDir, target);
  });
}

export function versionDirComplete(dir: string): boolean {
  return LINUX_RUNTIME_FILES.every((file) => fs.existsSync(path.posix.join(dir, file)));
}

// Copies the staged libraries into `<runtimeRoot>/<version>`; inert until links and env point at it.
export function materializeLinuxRuntime(
  stagingDir: string,
  runtimeRoot: string,
  version: string
): string {
  const finalDir = path.posix.join(runtimeRoot, version);
  if (versionDirComplete(finalDir)) {
    return finalDir;
  }
  const tmp = `${finalDir}.lbk-new`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const file of LINUX_RUNTIME_FILES) {
    const dest = path.posix.join(tmp, file);
    fs.copyFileSync(path.posix.join(stagingDir, LINUX_STAGED_SUBDIR, file), dest);
    fs.chmodSync(dest, LINUX_EXECUTABLES.has(file) ? 0o755 : 0o644);
  }
  fs.rmSync(finalDir, { recursive: true, force: true });
  fs.renameSync(tmp, finalDir);
  return finalDir;
}

export function applyLinuxLinks(
  steps: readonly LinkStep[]
): { link: string; backup: string }[] {
  const backups: { link: string; backup: string }[] = [];
  for (const step of steps) {
    fs.mkdirSync(path.posix.dirname(step.link), { recursive: true });
    if (step.backup) {
      fs.rmSync(step.backup, { force: true });
      fs.renameSync(step.link, step.backup);
      backups.push({ link: step.link, backup: step.backup });
    }
    replaceSymlinkAtomic(step.target, step.link);
  }
  return backups;
}

export function writeEnvironmentFile(envFile: string, runtimeLib: string): void {
  fs.mkdirSync(path.posix.dirname(envFile), { recursive: true });
  writeFileAtomic(envFile, renderEnvironmentFile(runtimeLib));
}

// Only links into our runtime are ours; another installer's links and its backup stay untouched.
export function removeLinuxLinks(
  steamHome: string,
  runtimeRoot: string,
  backups: readonly { link: string; backup: string }[]
): void {
  for (const { rel } of LINUX_LINKS) {
    const link = path.posix.join(steamHome, rel);
    const entry = readLinkEntry(link);
    if (entry.kind === 'symlink' && isUnder(entry.target, runtimeRoot)) {
      fs.rmSync(link, { force: true });
    }
  }
  for (const { link, backup } of backups) {
    if (readLinkEntry(link).kind === 'missing' && fs.existsSync(backup)) {
      fs.renameSync(backup, link);
    }
  }
}

// Keeps only the version dirs that are still referenced.
export function pruneRuntimeVersions(
  runtimeRoot: string,
  keep: ReadonlySet<string>
): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(runtimeRoot);
  } catch {
    return;
  }
  // Steam loads whatever `current` points to, recorded or not.
  let live: string | null = null;
  try {
    live = path.posix.basename(fs.readlinkSync(path.posix.join(runtimeRoot, 'current')));
  } catch {
    // No current link.
  }
  for (const entry of entries) {
    if (entry === 'current' || entry === live || keep.has(entry)) {
      continue;
    }
    fs.rmSync(path.posix.join(runtimeRoot, entry), { recursive: true, force: true });
  }
}
