import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { Game } from '../../shared/types';
import {
  BACKUP_DIR_NAME,
  BACKUP_DIR_NAME_LEGACY,
  BACKUP_SUFFIX,
  cleanupEmptyDirectories,
  findBackupDir,
  restoreBackupLegacy,
  restoreBackupNew,
} from './backup';
import {
  checkInstallation,
  deleteCachedInstallationInfo,
  findInstallationInfoFile,
  saveInstallationInfo,
} from './cache';
import { deleteDirectory } from './files';
import { getSteamAchievementsPath, runUninstaller } from './platform';

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

/**
 * Uninstall translation. Runs the bundled uninstaller (if any) first, then
 * restores backups and removes leftover translation files. Falls back to manual
 * cleanup if the uninstaller fails.
 */
export async function uninstallTranslation(game: Game): Promise<void> {
  try {
    console.log(`[Installer] Uninstalling translation for: ${game.id}`);

    const installInfo = await checkInstallation(game);
    if (!installInfo) {
      throw new Error('Українізатор не встановлено');
    }

    const gamePath = installInfo.gamePath;

    if (installInfo.installerPath && fs.existsSync(installInfo.installerPath)) {
      console.log(`[Uninstaller] Running uninstaller: ${installInfo.installerPath}`);
      try {
        await runUninstaller(installInfo.installerPath, installInfo.protonPath);
        console.log(`[Uninstaller] Uninstaller completed successfully`);
      } catch (uninstallerError) {
        console.error('[Installer] Uninstaller failed:', uninstallerError);
        console.log('[Installer] Proceeding with manual cleanup...');
      }
    }

    const backupDir = findBackupDir(gamePath);

    let allFilesToDelete: string[] = [];

    if (installInfo.components) {
      if (installInfo.components.text?.installed) {
        allFilesToDelete.push(...installInfo.components.text.files);
      }
      if (installInfo.components.voice?.installed) {
        allFilesToDelete.push(...installInfo.components.voice.files);
      }
      // Achievement files live in Steam's appcache, not the game dir.
      if (installInfo.components.achievements?.installed) {
        const achievementsPath = await getSteamAchievementsPath();
        if (achievementsPath) {
          for (const achievementFile of installInfo.components.achievements.files) {
            const fullPath = path.join(achievementsPath, achievementFile);
            await restoreOrDeleteFile(fullPath);
          }
        }
      }
    } else if (installInfo.installedFiles?.length) {
      allFilesToDelete = installInfo.installedFiles;
    }

    if (allFilesToDelete.length > 0) {
      console.log(`[Installer] Deleting ${allFilesToDelete.length} installed files...`);
      for (const relativePath of allFilesToDelete) {
        const filePath = path.join(gamePath, relativePath);
        await deleteFileAndCleanupDirs(filePath, gamePath);
      }
    }

    if (installInfo.hasBackup !== false) {
      if (fs.existsSync(backupDir)) {
        await restoreBackupLegacy(backupDir, gamePath);
        await deleteDirectory(backupDir);
      } else {
        await restoreBackupNew(gamePath, allFilesToDelete);
      }
    }

    await cleanupEmptyDirectories(gamePath, gamePath);

    const infoPath = findInstallationInfoFile(gamePath);
    if (fs.existsSync(infoPath)) {
      await unlink(infoPath);
    }
    await deleteCachedInstallationInfo(game.id);

    console.log(`[Installer] Translation for ${game.id} uninstalled successfully`);
  } catch (error) {
    console.error('[Installer] Uninstall error:', error);
    throw new Error(
      `Помилка видалення: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Remove individual components (voice / achievements) without uninstalling the
 * full translation. Updates the saved installation info to reflect the new state.
 */
export async function removeComponents(
  game: Game,
  componentsToRemove: { voice?: boolean; achievements?: boolean }
): Promise<void> {
  try {
    console.log(`[Installer] Removing components for: ${game.id}`, componentsToRemove);

    const installInfo = await checkInstallation(game);
    if (!installInfo) {
      throw new Error('Українізатор не встановлено');
    }

    const gamePath = installInfo.gamePath;

    if (componentsToRemove.voice && installInfo.components?.voice?.installed) {
      for (const relativePath of installInfo.components.voice.files) {
        const filePath = path.join(gamePath, relativePath);
        await restoreOrDeleteFile(filePath);
      }
      installInfo.components.voice = { installed: false, files: [] };
    }

    if (
      componentsToRemove.achievements &&
      installInfo.components?.achievements?.installed
    ) {
      const achievementsPath = await getSteamAchievementsPath();
      if (achievementsPath) {
        for (const achievementFile of installInfo.components.achievements.files) {
          const fullPath = path.join(achievementsPath, achievementFile);
          await restoreOrDeleteFile(fullPath);
        }
      }
      installInfo.components.achievements = { installed: false, files: [] };
    }

    await saveInstallationInfo(gamePath, installInfo);
    console.log(`[Installer] Components removed successfully for ${game.id}`);
  } catch (error) {
    console.error('[Installer] Error removing components:', error);
    throw new Error(
      `Помилка видалення компонентів: ${error instanceof Error ? error.message : 'Невідома помилка'}`
    );
  }
}

/**
 * Restore a file from backup (new `.lbk-backup/` dir or legacy `_backup`
 * suffix) or delete it if no backup exists.
 */
async function restoreOrDeleteFile(
  filePath: string,
  backupBaseDir?: string
): Promise<void> {
  const fileName = path.basename(filePath);
  const fileDir = path.dirname(filePath);

  const newBackupDir = backupBaseDir || findBackupDir(fileDir);
  const newBackupPath = path.join(newBackupDir, fileName);

  const legacyBackupPath = filePath + BACKUP_SUFFIX;

  try {
    if (fs.existsSync(newBackupPath)) {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
      await fs.promises.rename(newBackupPath, filePath);
      console.log(`[Installer] Restored from backup dir: ${fileName}`);
      return;
    }

    if (fs.existsSync(legacyBackupPath)) {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
      await fs.promises.rename(legacyBackupPath, filePath);
      console.log(`[Installer] Restored from legacy backup: ${fileName}`);
      return;
    }

    if (fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log(`[Installer] Deleted (no backup): ${fileName}`);
    }
  } catch (error) {
    console.warn(`[Installer] Failed to restore/delete ${filePath}:`, error);
  }
}

/**
 * Delete a file then walk up removing now-empty parent dirs, stopping at
 * `rootDir` or the backup directory.
 */
async function deleteFileAndCleanupDirs(
  filePath: string,
  rootDir: string
): Promise<void> {
  try {
    if (filePath.includes(BACKUP_DIR_NAME) || filePath.includes(BACKUP_DIR_NAME_LEGACY)) {
      console.warn(`[Installer] Skipping deletion of backup file: ${filePath}`);
      return;
    }

    if (fs.existsSync(filePath)) {
      await unlink(filePath);
      console.log(`[Installer] Deleted: ${path.relative(rootDir, filePath)}`);

      let dirPath = path.dirname(filePath);
      while (dirPath !== rootDir) {
        if (
          dirPath.includes(BACKUP_DIR_NAME) ||
          dirPath.includes(BACKUP_DIR_NAME_LEGACY) ||
          path.basename(dirPath) === BACKUP_DIR_NAME ||
          path.basename(dirPath) === BACKUP_DIR_NAME_LEGACY
        ) {
          break;
        }
        try {
          const entries = await readdir(dirPath);
          if (entries.length === 0) {
            await fs.promises.rmdir(dirPath);
            dirPath = path.dirname(dirPath);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    }
  } catch (error) {
    console.warn(`[Installer] Failed to delete ${filePath}:`, error);
  }
}
