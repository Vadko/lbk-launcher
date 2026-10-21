import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { readTextOrNull } from '../utils/fs-safe';
import { isLinux } from '../utils/platform';

// One line of EGLv2's append-only install log; the header line has no installationId
const installationSchema = z.object({
  installationId: z.string().min(1),
  complete: z.boolean().optional(),
  deleted: z.boolean().optional(),
  dir: z.string().optional(),
  parentInstallationId: z.string().optional(),
});

type InstallationRecord = z.infer<typeof installationSchema>;

export function getEglInstallationsPath(): string | null {
  return isLinux()
    ? path.join(os.homedir(), '.local/share/com.epicgames.eglv2/installations.jsonl')
    : null;
}

function parseRecord(line: string): InstallationRecord | undefined {
  try {
    return installationSchema.safeParse(JSON.parse(line)).data;
  } catch {
    return undefined;
  }
}

function replayInstallDirs(log: string): string[] {
  const latest = new Map(
    log
      .split('\n')
      .map(parseRecord)
      .filter((record) => record !== undefined)
      .map((record) => [record.installationId, record])
  );
  return [...latest.values()].flatMap((record) =>
    record.complete &&
    !record.deleted &&
    !record.parentInstallationId &&
    record.dir &&
    path.isAbsolute(record.dir)
      ? [record.dir]
      : []
  );
}

// Keyed by the log's contents: an unchanged file is not parsed again
const installDirs = new LRUCache<string, string[]>({
  max: 1,
  memoMethod: replayInstallDirs,
});

export function getEglInstallDirs(): string[] {
  const file = getEglInstallationsPath();
  const log = file ? readTextOrNull(file) : null;
  return log ? installDirs.memo(log).filter((dir) => fs.existsSync(dir)) : [];
}
