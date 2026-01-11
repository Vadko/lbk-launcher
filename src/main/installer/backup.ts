import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

export const BACKUP_SUFFIX = '_backup'; // file.upk -> file.upk_backup

/**
 * Backup files that will be overwritten using new format (file.upk -> file.upk_backup)
 * Files are backed up in place, not in a separate directory
 * This prevents games from detecting backup files by extension scanning
 */
export async function backupFiles(sourceDir: string, targetDir: string): Promise<void> {
  try {
    // Read all files from source directory (files that will be installed)
    const entries = await readdir(sourceDir, { withFileTypes: true });
    let backedUpCount = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively backup subdirectory
        await backupFiles(sourcePath, targetPath);
      } else {
        // Check if file exists in target directory
        if (fs.existsSync(targetPath)) {
          const backupPath = targetPath + BACKUP_SUFFIX; // file.upk -> file.upk_backup

          // Only create backup if it doesn't exist (preserve original files)
          if (!fs.existsSync(backupPath)) {
            await fs.promises.copyFile(targetPath, backupPath);
            console.log(
              `[Backup] Backed up: ${entry.name} -> ${entry.name}${BACKUP_SUFFIX}`
            );
            backedUpCount++;
          } else {
            console.log(
              `[Backup] Backup already exists, skipping: ${entry.name}${BACKUP_SUFFIX}`
            );
          }
        }
      }
    }

    if (backedUpCount > 0) {
      console.log(`[Backup] Backup completed: ${backedUpCount} files backed up in place`);
    }
  } catch (error) {
    console.error('[Backup] Error creating backup:', error);
    throw new Error(
      `Помилка створення резервної копії: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Restore files from backup (legacy format - .lbk-backup directory)
 */
export async function restoreBackupLegacy(
  backupDir: string,
  targetDir: string
): Promise<void> {
  try {
    const entries = await readdir(backupDir, { withFileTypes: true });

    for (const entry of entries) {
      const backupPath = path.join(backupDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively restore subdirectory
        await restoreBackupLegacy(backupPath, targetPath);
      } else {
        // Restore file
        await fs.promises.copyFile(backupPath, targetPath);
        console.log(`[Restore] Restored (legacy): ${entry.name}`);
      }
    }

    console.log('[Restore] Legacy restore completed');
  } catch (error) {
    console.error('[Restore] Error restoring backup:', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Restore files from new backup format (file.upk_backup -> file.upk)
 * Searches for *_backup files and restores them
 */
export async function restoreBackupNew(
  targetDir: string,
  installedFiles: string[]
): Promise<void> {
  try {
    let restoredCount = 0;

    for (const relativePath of installedFiles) {
      const targetPath = path.join(targetDir, relativePath);
      const backupPath = targetPath + BACKUP_SUFFIX;

      if (fs.existsSync(backupPath)) {
        // Restore the original file from backup
        await fs.promises.copyFile(backupPath, targetPath);
        // Delete the backup file
        await unlink(backupPath);
        console.log(
          `[Restore] Restored: ${path.basename(targetPath)} from ${path.basename(backupPath)}`
        );
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(
        `[Restore] New format restore completed: ${restoredCount} files restored`
      );
    }
  } catch (error) {
    console.error('[Restore] Error restoring backup (new format):', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clean up empty directories recursively
 */
export async function cleanupEmptyDirectories(
  dir: string,
  rootDir: string
): Promise<void> {
  try {
    if (!fs.existsSync(dir)) return;

    const entries = await readdir(dir, { withFileTypes: true });

    // Recursively clean subdirectories first
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name);
        await cleanupEmptyDirectories(subDir, rootDir);
      }
    }

    // Check if directory is now empty
    const remainingEntries = await readdir(dir);
    if (remainingEntries.length === 0 && dir !== rootDir) {
      await fs.promises.rmdir(dir);
      console.log(`[Cleanup] Deleted empty directory: ${path.relative(rootDir, dir)}`);
    }
  } catch (error) {
    console.warn(`[Cleanup] Failed to cleanup directory ${dir}:`, error);
  }
}
