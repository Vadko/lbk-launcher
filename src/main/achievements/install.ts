import fs from 'node:fs';
import path from 'node:path';
import { downloadAndExtractArchive } from '@/main/installer/download-and-extract';
import { getAllFiles } from '@/main/installer/files';
import {
  type ExtractedAchievementStrings,
  extractAchievementStrings,
} from '@/main/utils/achievement-strings';
import { t } from '@/shared/i18n/i18n';
import type {
  AchievementsComponent,
  DownloadProgress,
  Game,
  InstallationStatus,
  Platform,
} from '@/shared/types';
import { legacySchemaAppIds, removeLegacyStatsFiles } from './legacy';
import {
  hasAchievementStrings,
  removeStoredStrings,
  saveAchievementStrings,
} from './strings-store';

const SCHEMA_FILE = /^UserGameStatsSchema_\d+\.bin$/i;

export interface PreparedAchievements {
  extracted: ExtractedAchievementStrings[];
  component: AchievementsComponent | null;
  archiveHash: string | null;
}

// Parses every schema in an extracted achievements archive; schemas without Ukrainian strings are dropped.
export async function readAchievementStringsFromDir(
  dir: string
): Promise<ExtractedAchievementStrings[]> {
  const byApp = new Map<number, ExtractedAchievementStrings>();
  for (const relativePath of await getAllFiles(dir)) {
    const fileName = path.basename(relativePath);
    if (!SCHEMA_FILE.test(fileName)) {
      continue;
    }
    try {
      const buf = await fs.promises.readFile(path.join(dir, relativePath));
      const extracted = extractAchievementStrings(buf, fileName);
      const count = Object.keys(extracted.strings).length;
      if (count === 0) {
        console.warn(`[Achievements] ${fileName} has no Ukrainian strings`);
        continue;
      }
      byApp.set(extracted.appId, extracted);
      console.log(
        `[Achievements] ${fileName}: ${count} strings for app ${extracted.appId}`
      );
    } catch (error) {
      console.warn(`[Achievements] Failed to parse ${fileName}:`, error);
    }
  }
  return [...byApp.values()];
}

// A re-install is skipped only for the same archive whose strings this game still owns.
export function isAchievementsComponentCurrent(
  existing: AchievementsComponent | undefined,
  gameId: string,
  archiveHash: string | null
): boolean {
  return (
    archiveHash !== null &&
    existing?.installed === true &&
    existing.archiveHash === archiveHash &&
    // Legacy installs keep schema files in Steam's stats dir and need a fresh download.
    existing.files.length === 0 &&
    hasAchievementStrings(existing.appIds ?? [], gameId)
  );
}

// Steam only: strings are parsed out of the schemas and delivered by the LBK Bridge plugin.
export async function prepareAchievements(i: {
  game: Game;
  platform: Platform;
  wanted: boolean;
  existing: AchievementsComponent | undefined;
  downloadDir: string;
  isFirstSession: boolean;
  onDownloadProgress?: (progress: DownloadProgress) => void;
  onStatus?: (status: InstallationStatus) => void;
}): Promise<PreparedAchievements> {
  const { game } = i;
  const archiveHash = game.achievements_archive_hash || null;
  const archivePath = game.achievements_archive_path;
  if (!i.wanted || !archivePath || i.platform !== 'steam') {
    return { extracted: [], component: null, archiveHash };
  }
  if (archiveHash && isAchievementsComponentCurrent(i.existing, game.id, archiveHash)) {
    console.log('[Installer] Achievement strings already up-to-date, skipping download');
    return {
      extracted: [],
      component: {
        installed: true,
        files: [],
        archiveHash,
        appIds: i.existing?.appIds ?? [],
      },
      archiveHash,
    };
  }

  const extractDir = path.join(i.downloadDir, `${game.id}_achievements_extract`);
  await downloadAndExtractArchive({
    game,
    type: 'achievements',
    archivePath,
    archiveHash: game.achievements_archive_hash,
    downloadDir: i.downloadDir,
    extractDir,
    isFirstSession: i.isFirstSession,
    onDownloadProgress: i.onDownloadProgress,
    onStatus: (status) =>
      i.onStatus?.({
        message: t('installSteps.status', { message: status.message }),
        phase: status.phase,
      }),
  });
  const extracted = await readAchievementStringsFromDir(extractDir);
  if (extracted.length === 0) {
    // Catalog data bug: the rest of the install goes on without achievements.
    console.error(
      `[Installer] Achievements archive of ${game.id} has no Ukrainian strings`
    );
    return { extracted, component: null, archiveHash };
  }
  return {
    extracted,
    component: {
      installed: true,
      files: [],
      ...(archiveHash ? { archiveHash } : {}),
      appIds: extracted.map(({ appId }) => appId),
    },
    archiveHash,
  };
}

// Strings in `keepAppIds` stay: a reinstall has just rewritten them.
export async function removeInstalledAchievements(
  gameId: string,
  component: Pick<AchievementsComponent, 'files' | 'appIds'>,
  keepAppIds: ReadonlySet<number> = new Set()
): Promise<void> {
  if (component.files.length > 0) {
    await removeLegacyStatsFiles(component.files);
  }
  const appIds = new Set([
    ...(component.appIds ?? []),
    ...legacySchemaAppIds(component.files),
  ]);
  for (const appId of appIds) {
    if (!keepAppIds.has(appId)) {
      removeStoredStrings(appId, gameId);
    }
  }
}

// Runs after the game files are copied: a strings failure (full or locked userData) only drops the achievements.
export async function commitAchievementStrings(i: {
  extracted: readonly ExtractedAchievementStrings[];
  gameId: string;
  archiveHash: string | null;
  component: AchievementsComponent | null;
  previous: { gameId: string; component: AchievementsComponent } | null;
}): Promise<AchievementsComponent | null> {
  let component = i.component;
  try {
    if (i.extracted.length > 0) {
      saveAchievementStrings(i.extracted, i.gameId, i.archiveHash);
    }
  } catch (error) {
    console.error('[Achievements] Saving achievement strings failed:', error);
    await removeInstalledAchievements(i.gameId, {
      files: [],
      appIds: i.extracted.map(({ appId }) => appId),
    }).catch(() => undefined);
    component = null;
  }
  if (i.previous) {
    try {
      await removeInstalledAchievements(
        i.previous.gameId,
        i.previous.component,
        new Set(component?.appIds ?? [])
      );
    } catch (error) {
      console.warn('[Achievements] Removing the previous strings failed:', error);
    }
  }
  return component;
}
