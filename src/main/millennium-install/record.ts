import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { writeFileAtomic } from '@/main/utils/atomic-write';
import { readJsonFile } from '@/main/utils/json-file';
import { LINK_BACKUP_SUFFIX, LINUX_LINK_RELS } from './linux';
import { LINUX_ENV_FILE_NAME, MAC_WRAPPER_APP } from './paths';
import type { MillenniumOs } from './release';

const INSTALL_RECORD_FILE = '.lbk-install.json';

const nonEmpty = z.string().min(1);

// These paths are later deleted or renamed, and the record sits where any Millennium plugin can write.
const plainAbsolutePath = z
  .string()
  .refine((p) => path.posix.isAbsolute(p) && !p.split('/').includes('..'));

const linkBackup = z
  .object({ link: plainAbsolutePath, backup: z.string() })
  .refine(
    ({ link, backup }) =>
      LINUX_LINK_RELS.some((rel) => link.endsWith(`/.steam/steam/${rel}`)) &&
      backup === `${link}${LINK_BACKUP_SUFFIX}`
  );

const recordFields = {
  format: z.literal(1),
  tag: nonEmpty,
  version: nonEmpty,
  activatedAt: nonEmpty,
  steamPath: nonEmpty,
  // Linux: pre-existing regular files (Valve's own libXtst) moved aside before linking.
  xtstBackups: z.array(linkBackup),
  runtimeDir: nonEmpty.optional(),
  envFile: plainAbsolutePath
    .refine((p) => p.endsWith(`/environment.d/${LINUX_ENV_FILE_NAME}`))
    .optional(),
  appBundle: plainAbsolutePath
    .refine(
      (p) =>
        path.posix.basename(p) === MAC_WRAPPER_APP &&
        path.posix.basename(path.posix.dirname(p)) === 'Applications'
    )
    .optional(),
};

const installRecordSchema = z.discriminatedUnion('os', [
  z.object({ ...recordFields, os: z.literal('windows'), mode: z.literal('windows') }),
  z.object({ ...recordFields, os: z.literal('linux'), mode: z.literal('linux-user') }),
  z.object({ ...recordFields, os: z.literal('macos'), mode: z.literal('macos-wrapper') }),
]);

export type MillenniumInstallRecord = z.infer<typeof installRecordSchema>;

export function parseInstallRecord(raw: unknown): MillenniumInstallRecord | null {
  return installRecordSchema.safeParse(raw).data ?? null;
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

// The record describes this Steam's Millennium files, so it lives and dies with them.
export function recordPathIn(millenniumRoot: string): string {
  return path.join(millenniumRoot, INSTALL_RECORD_FILE);
}

export function readInstallRecord(file: string): MillenniumInstallRecord | null {
  return readJsonFile(file, installRecordSchema);
}

export function writeInstallRecord(file: string, record: MillenniumInstallRecord): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, `${JSON.stringify(record, null, 2)}\n`);
}

export function deleteInstallRecord(file: string): void {
  fs.rmSync(file, { force: true });
}
