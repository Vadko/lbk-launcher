import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import { Constants } from '@/lib/database.types';
import { readJsonFile } from '@/main/utils/json-file';
import type { AchievementsComponent, InstallationInfo } from '@/shared/types';

export const INSTALLATION_INFO_FILE = '.lbk-translation.json';

const componentSchema = z.looseObject({
  installed: z.boolean(),
  files: z.array(z.string()),
  archiveHash: z.string().optional(),
});

// Loose: a record rewritten from this keeps every field an older or newer LBK wrote.
const installationInfoSchema = z.looseObject({
  gameId: z.string(),
  version: z.string(),
  installedAt: z.string(),
  gamePath: z.string(),
  hasBackup: z.boolean().optional(),
  hasInstallError: z.boolean().optional(),
  protonPath: z.string().optional(),
  isCustomPath: z.boolean().optional(),
  installerPath: z.string().optional(),
  installedFiles: z.array(z.string()).optional(),
  installedPlatform: z.enum(Constants.public.Enums.install_source).optional(),
  components: z
    .looseObject({
      text: componentSchema,
      voice: componentSchema.optional(),
      achievements: componentSchema
        .extend({ appIds: z.array(z.number()).optional() })
        .optional(),
    })
    .optional(),
}) satisfies z.ZodType<InstallationInfo>;

const getInstallationCacheDir = (): string =>
  path.join(app.getPath('userData'), 'installation-cache');

/**
 * Find the installation info file path, supporting both new and legacy formats.
 * If old format is found, attempts to rename it to the new format.
 * @param gamePath The path to the game installation directory.
 * @returns The path to the installation info file.
 */
export function findInstallationInfoFile(gamePath: string) {
  const oldFormatPath = path.join(gamePath, '.littlebit-translation.json');
  const newFormatPath = path.join(gamePath, INSTALLATION_INFO_FILE);

  if (fs.existsSync(oldFormatPath)) {
    try {
      // Try to rename old format to new format
      fs.renameSync(oldFormatPath, newFormatPath);
      return newFormatPath;
    } catch (error) {
      // If rename fails, return path to old format
      console.warn(
        '[Installer] Failed to rename old format file, using old path:',
        error
      );
      return oldFormatPath;
    }
  }

  return newFormatPath;
}

// A corrupt or mismatched cache entry is skipped: it is the installer's problem, not the caller's.
export function listInstallationRecords(): InstallationInfo[] {
  const dir = getInstallationCacheDir();
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const info = readJsonFile(path.join(dir, name), installationInfoSchema);
    return info?.gameId === name.slice(0, -'.json'.length) ? [info] : [];
  });
}

// Both copies, since checkInstallation prefers the game folder's; another translation's file there stays untouched.
export async function rewriteInstallationRecord(
  record: InstallationInfo,
  update: (info: InstallationInfo) => InstallationInfo
): Promise<void> {
  try {
    const gameInfoPath = findInstallationInfoFile(record.gamePath);
    const gameInfo = readJsonFile(gameInfoPath, installationInfoSchema);
    if (gameInfo?.gameId === record.gameId) {
      await fs.promises.writeFile(
        gameInfoPath,
        JSON.stringify(update(gameInfo), null, 2),
        'utf-8'
      );
    }
  } catch (error) {
    console.warn(`[Installer] Could not update ${record.gamePath} install info:`, error);
  }
  await fs.promises.writeFile(
    path.join(getInstallationCacheDir(), `${record.gameId}.json`),
    JSON.stringify(update(record), null, 2),
    'utf-8'
  );
}

// A components-only change keeps the record as installed; only the achievements entry is replaced or dropped.
export function withAchievementsComponent(
  base: InstallationInfo,
  achievements: AchievementsComponent | null
): InstallationInfo {
  const components = {
    ...(base.components ?? { text: { installed: false, files: [] } }),
  };
  delete components.achievements;
  return {
    ...base,
    components: achievements ? { ...components, achievements } : components,
  };
}
