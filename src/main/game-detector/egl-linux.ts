import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { isPathInside, readTextOrNull } from '../utils/fs-safe';
import { isFlatpak } from '../utils/host-exec';
import { readJsonFile } from '../utils/json-file';
import { parseLaunchCommand } from '../utils/launch-command';
import { isLinux } from '../utils/platform';

// One line of EGLv2's append-only install log; the header line has no installationId
const installationSchema = z.object({
  installationId: z.string().min(1),
  complete: z.boolean().optional(),
  deleted: z.boolean().optional(),
  dir: z.string().optional(),
  parentInstallationId: z.string().optional(),
  namespace: z.string().optional(),
  itemId: z.string().optional(),
  artifactId: z.string().optional(),
  launchExecutable: z.string().optional(),
  launchCommand: z.string().optional(),
});

type InstallationRecord = z.infer<typeof installationSchema>;

type EglInstall = InstallationRecord & { dir: string };

function getEglDataRoot(): string | null {
  if (!isLinux()) {
    return null;
  }
  // Inside our Flatpak XDG_DATA_HOME points at the sandbox, not where EGL writes
  const dataHome =
    (!isFlatpak() && process.env.XDG_DATA_HOME) ||
    path.join(os.homedir(), '.local/share');
  return path.join(dataHome, 'com.epicgames.eglv2');
}

export function getEglInstallationsPath(): string | null {
  const root = getEglDataRoot();
  return root && path.join(root, 'installations.jsonl');
}

function parseRecord(line: string): InstallationRecord | undefined {
  try {
    return installationSchema.safeParse(JSON.parse(line)).data;
  } catch {
    return undefined;
  }
}

function replayInstalls(log: string): EglInstall[] {
  const latest = new Map(
    log
      .split('\n')
      .map(parseRecord)
      .filter((record) => record !== undefined)
      .map((record) => [record.installationId, record])
  );
  return [...latest.values()].flatMap(({ dir, ...record }) =>
    record.complete &&
    !record.deleted &&
    !record.parentInstallationId &&
    dir &&
    path.isAbsolute(dir)
      ? [{ ...record, dir }]
      : []
  );
}

// Keyed by the log's contents: an unchanged file is not parsed again
const installs = new LRUCache<string, EglInstall[]>({
  max: 1,
  memoMethod: replayInstalls,
});

function getEglInstalls(): EglInstall[] {
  const file = getEglInstallationsPath();
  const log = file ? readTextOrNull(file) : null;
  return log ? installs.memo(log).filter(({ dir }) => fs.existsSync(dir)) : [];
}

export function getEglInstallDirs(): string[] {
  return getEglInstalls().map(({ dir }) => dir);
}

const pinCacheSchema = z.object({ version: z.string().min(1) });

// EGL keeps the GE-Proton it downloaded in a folder named after the version pin-cache.json pins
function getEglProtonDir(root: string): string | null {
  const runtime = path.join(root, 'compat/runtime');
  const pin = readJsonFile(path.join(runtime, 'pin-cache.json'), pinCacheSchema);
  const dir = pin && path.join(runtime, pin.version);
  return dir && isPathInside(runtime, dir) && fs.existsSync(path.join(dir, 'proton'))
    ? dir
    : null;
}

function findEglInstall(gameDir: string): EglInstall | undefined {
  return getEglInstalls().find(({ dir }) => dir === gameDir);
}

// The Windows deep-link id; EGLv2 0.100 resolves it, and a bare manifest AppName it does not
export function getEglDeepLink(gameDir: string): string | null {
  const install = findEglInstall(gameDir);
  return install?.namespace && install.itemId && install.artifactId
    ? `com.epicgames.launcher://apps/${[install.namespace, install.itemId, install.artifactId].map(encodeURIComponent).join('%3A')}?action=launch&silent=true`
    : null;
}

export interface EglLaunchTarget {
  gameDir: string;
  executable: string;
  args: string[];
  prefix: string;
  protonDir: string;
}

export function getEglLaunchTarget(gameDir: string): EglLaunchTarget | null {
  const root = getEglDataRoot();
  const install = findEglInstall(gameDir);
  const protonDir = root && getEglProtonDir(root);
  if (!root || !install?.artifactId || !install.launchExecutable || !protonDir) {
    return null;
  }
  const launchCommand = parseLaunchCommand(install.launchCommand ?? '');
  if (!launchCommand) {
    console.warn(
      '[EGL] Launch command needs a shell, launching without it:',
      install.launchCommand
    );
  }
  const executable = path.join(gameDir, install.launchExecutable.replaceAll('\\', '/'));
  const compatData = path.join(root, 'compat/compatdata');
  const prefix = path.join(compatData, install.artifactId);
  return isPathInside(gameDir, executable) &&
    isPathInside(compatData, prefix) &&
    fs.existsSync(executable)
    ? {
        gameDir,
        executable,
        args: launchCommand?.args ?? [],
        prefix,
        protonDir,
      }
    : null;
}
