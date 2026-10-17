import * as fs from 'node:fs';
import * as path from 'node:path';
import { G } from '@mobily/ts-belt';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { LINK_BACKUP_SUFFIX, LINUX_LINK_RELS } from './linux';
import { LINUX_ENV_FILE_NAME, MAC_WRAPPER_APP } from './paths';
import type { MillenniumOs } from './release';

type MillenniumInstallMode = 'windows' | 'linux-user' | 'macos-wrapper';

export interface MillenniumInstallRecord {
  format: 1;
  os: MillenniumOs;
  mode: MillenniumInstallMode;
  tag: string;
  version: string;
  activatedAt: string;
  steamPath: string;
  // Linux: pre-existing regular files (Valve's own libXtst) moved aside before linking.
  xtstBackups: { link: string; backup: string }[];
  runtimeDir?: string;
  envFile?: string;
  appBundle?: string;
}

const RECORD_FILE = '.lbk-install.json';

const MODE_FOR_OS: Record<MillenniumOs, MillenniumInstallMode> = {
  windows: 'windows',
  linux: 'linux-user',
  macos: 'macos-wrapper',
};

function optionalString(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length > 0);
}

function isPlainAbsolute(value: string): boolean {
  return (
    path.posix.isAbsolute(value) && !value.split('/').some((segment) => segment === '..')
  );
}

// These paths are later deleted or renamed, and the record sits where any Millennium plugin can write.
function optionalPath(value: unknown, valid: (p: string) => boolean): boolean {
  return value === undefined || (typeof value === 'string' && valid(value));
}

function isWrapperAppPath(p: string): boolean {
  return (
    isPlainAbsolute(p) &&
    path.posix.basename(p) === MAC_WRAPPER_APP &&
    path.posix.basename(path.posix.dirname(p)) === 'Applications'
  );
}

function isEnvFilePath(p: string): boolean {
  return isPlainAbsolute(p) && p.endsWith(`/environment.d/${LINUX_ENV_FILE_NAME}`);
}

function isLinkBackup(b: unknown): boolean {
  if (!G.isObject(b) || typeof b.link !== 'string' || typeof b.backup !== 'string') {
    return false;
  }
  const link = b.link;
  return (
    isPlainAbsolute(link) &&
    LINUX_LINK_RELS.some((rel) => link.endsWith(`/.steam/steam/${rel}`)) &&
    b.backup === `${link}${LINK_BACKUP_SUFFIX}`
  );
}

export function parseInstallRecord(raw: unknown): MillenniumInstallRecord | null {
  if (!G.isObject(raw) || raw.format !== 1) {
    return null;
  }
  const os = raw.os;
  if (os !== 'windows' && os !== 'linux' && os !== 'macos') {
    return null;
  }
  if (raw.mode !== MODE_FOR_OS[os]) {
    return null;
  }
  for (const key of ['tag', 'version', 'activatedAt', 'steamPath'] as const) {
    if (typeof raw[key] !== 'string' || raw[key] === '') {
      return null;
    }
  }
  if (!optionalString(raw.runtimeDir) || !optionalPath(raw.envFile, isEnvFilePath)) {
    return null;
  }
  if (!optionalPath(raw.appBundle, isWrapperAppPath)) {
    return null;
  }
  const backups = raw.xtstBackups;
  if (!Array.isArray(backups) || !backups.every(isLinkBackup)) {
    return null;
  }
  return raw as unknown as MillenniumInstallRecord;
}

function normalizeSteamPath(os: MillenniumOs, value: string): string {
  if (os === 'windows') {
    return path.win32
      .normalize(value)
      .replace(/[\\/]+$/, '')
      .toLowerCase();
  }
  return path.posix.normalize(value).replace(/\/+$/, '');
}

export function managedByFor(
  record: MillenniumInstallRecord | null,
  os: MillenniumOs,
  steamPath: string | null
): 'lbk' | 'external' {
  if (!record || record.os !== os || !steamPath) {
    return 'external';
  }
  return normalizeSteamPath(os, record.steamPath) === normalizeSteamPath(os, steamPath)
    ? 'lbk'
    : 'external';
}

// The record lives inside Millennium's own data root so it survives LBK's clear-all-data.
export function recordPathIn(millenniumRoot: string): string {
  return path.join(millenniumRoot, RECORD_FILE);
}

export function readInstallRecord(file: string): MillenniumInstallRecord | null {
  try {
    return parseInstallRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

export function writeInstallRecord(file: string, record: MillenniumInstallRecord): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, `${JSON.stringify(record, null, 2)}\n`);
}

export function deleteInstallRecord(file: string): void {
  fs.rmSync(file, { force: true });
}
