import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { errnoCode } from '../../shared/errors';
import { isLinux } from '../utils/platform';

const epicLauncherInstallationsHeaderSchema = z.object({
  version: z.number(),
  entries: z.number(),
});

const epicLauncherInstallationSchema = z.object({
  installationId: z.string().min(1).optional(),
  complete: z.boolean().optional(),
  deleted: z.boolean().optional(),
  dir: z.string().optional(),
  platform: z.string().optional(),
  artifactId: z.string().min(1).optional(),
});

type EpicLauncherInstallation = z.infer<typeof epicLauncherInstallationSchema>;
type InstalledEpicLauncherGame = Omit<EpicLauncherInstallation, 'dir'> & {
  dir: string;
};

export function getEpicLauncherInstallationsPath(): string | null {
  if (!isLinux()) {
    return null;
  }

  return path.join(os.homedir(), '.local/share/com.epicgames.eglv2/installations.jsonl');
}

function readEpicLauncherInstallations(): InstalledEpicLauncherGame[] {
  const installationsPath = getEpicLauncherInstallationsPath();
  if (!installationsPath) {
    return [];
  }

  let contents: string;
  try {
    contents = fs.readFileSync(installationsPath, 'utf8');
  } catch (error) {
    if (errnoCode(error) !== 'ENOENT') {
      console.error(
        `[Epic] Error reading installations file ${installationsPath}:`,
        error
      );
    }
    return [];
  }

  const latestById = new Map<string, EpicLauncherInstallation>();
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      console.warn(`[Epic] Skipping malformed installation record: ${error}`);
      continue;
    }

    const parsed = epicLauncherInstallationSchema.safeParse(value);
    if (!parsed.success) {
      if (!epicLauncherInstallationsHeaderSchema.safeParse(value).success) {
        console.warn(
          `[Epic] Skipping invalid installation record in ${installationsPath}`
        );
      }
      continue;
    }

    const installationId = parsed.data.installationId ?? parsed.data.artifactId;
    if (!installationId) {
      console.warn(`[Epic] Skipping installation without an ID in ${installationsPath}`);
      continue;
    }
    latestById.set(installationId, parsed.data);
  }

  const installations: InstalledEpicLauncherGame[] = [];
  for (const installation of latestById.values()) {
    const dir = installation.dir;
    if (
      installation.deleted ||
      !installation.complete ||
      installation.platform !== 'Windows' ||
      !dir ||
      !path.isAbsolute(dir)
    ) {
      continue;
    }

    try {
      if (fs.statSync(dir).isDirectory()) {
        installations.push({ ...installation, dir });
      }
    } catch (error) {
      if (errnoCode(error) !== 'ENOENT') {
        console.warn(`[Epic] Cannot check game directory ${dir}:`, error);
      }
    }
  }

  return installations;
}

export function getEpicLauncherInstallPaths(): string[] {
  return [
    ...new Set(readEpicLauncherInstallations().map((installation) => installation.dir)),
  ];
}

export function getEpicLauncherAppName(gamePath: string): string | null {
  const resolvedGamePath = path.resolve(gamePath);
  return (
    readEpicLauncherInstallations().find(
      (installation) => path.resolve(installation.dir) === resolvedGamePath
    )?.artifactId ?? null
  );
}
