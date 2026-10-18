import fs from 'node:fs';
import path from 'node:path';
import { getSteamPath } from '@/main/game-detector/steam';
import { BACKUP_SUFFIX } from '@/main/installer/backup';
import {
  listInstallationRecords,
  rewriteInstallationRecord,
} from '@/main/installer/cache';
import { withAchievementsComponent } from '@/main/installer/installation-info';
import type { AchievementsComponent } from '@/shared/types';
import { removeStoredStrings } from './strings-store';

const SCHEMA_FILE = /^UserGameStatsSchema_(\d+)\.bin$/i;

// v2.0–v2.23.1 copied the archive's schemas into Steam's appcache/stats; `files` lists them.
function getSteamStatsDir(): string | null {
  const steamPath = getSteamPath();
  return steamPath ? path.join(steamPath, 'appcache', 'stats') : null;
}

export function legacySchemaAppIds(files: readonly string[]): number[] {
  return files.flatMap((file) => {
    const match = SCHEMA_FILE.exec(path.basename(file));
    const appId = match ? Number(match[1]) : NaN;
    return Number.isSafeInteger(appId) && appId > 0 ? [appId] : [];
  });
}

// Every listed file is ours: the backup goes back, or the file goes. Steam re-fetches a schema that then differs.
async function restoreOrDeleteStatsFile(fullPath: string): Promise<boolean> {
  const backupPath = fullPath + BACKUP_SUFFIX;
  try {
    if (fs.existsSync(backupPath)) {
      await fs.promises.rename(backupPath, fullPath);
      console.log(`[Achievements] Restored ${path.basename(fullPath)} from backup`);
    } else if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      console.log(`[Achievements] Deleted legacy ${path.basename(fullPath)}`);
    }
    return true;
  } catch (error) {
    console.warn(`[Achievements] Failed to clean up ${fullPath}:`, error);
    return false;
  }
}

export async function removeLegacyStatsFiles(
  files: readonly string[]
): Promise<'done' | 'partial' | 'no-steam'> {
  const statsDir = getSteamStatsDir();
  if (!statsDir) {
    return 'no-steam';
  }
  let done = true;
  for (const file of files) {
    if (!(await restoreOrDeleteStatsFile(path.join(statsDir, path.basename(file))))) {
      done = false;
    }
  }
  return done ? 'done' : 'partial';
}

// Startup only. The component is marked not installed instead of re-downloaded, so the install dialog offers it again.
export async function migrateLegacyAchievements(): Promise<boolean> {
  let changed = false;
  for (const record of listInstallationRecords()) {
    const component = record.components?.achievements;
    if (!component?.installed || component.files.length === 0) {
      continue;
    }
    const removal = await removeLegacyStatsFiles(component.files);
    if (removal === 'no-steam') {
      console.warn('[Achievements] Steam not found, legacy migration postponed');
      return changed;
    }
    if (removal === 'partial') {
      continue;
    }
    for (const appId of [
      ...legacySchemaAppIds(component.files),
      ...(component.appIds ?? []),
    ]) {
      removeStoredStrings(appId, record.gameId);
    }
    const notInstalled: AchievementsComponent = { installed: false, files: [] };
    try {
      await rewriteInstallationRecord(record, (info) =>
        withAchievementsComponent(info, notInstalled)
      );
      changed = true;
      console.log(`[Achievements] Removed the legacy achievements of ${record.gameId}`);
    } catch (error) {
      console.warn(
        `[Achievements] Could not rewrite install info of ${record.gameId}:`,
        error
      );
    }
  }
  return changed;
}
