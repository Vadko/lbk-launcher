import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const execPromise = promisify(exec);

export const BACKUP_SUFFIX = '_backup'; // Legacy format: file.upk -> file.upk_backup
export const BACKUP_DIR_NAME = '.lbk-backup'; // New format: hidden directory in game folder

/**
 * Set hidden attribute on a folder (Windows only)
 */
async function setHiddenAttribute(dirPath: string): Promise<void> {
  if (process.platform !== 'win32') return;

  try {
    await execPromise(`attrib +h "${dirPath}"`);
    console.log(`[Backup] Set hidden attribute on: ${dirPath}`);
  } catch (error) {
    console.warn(`[Backup] Failed to set hidden attribute:`, error);
  }
}

/**
 * Backup files that will be overwritten to a hidden .littlebit-backup directory
 * This keeps backups separate from game files to prevent detection issues
 */
export async function backupFiles(
  sourceDir: string,
  targetDir: string,
  backupDir?: string,
  relativePath = ''
): Promise<void> {
  try {
    // Initialize backup directory on first call
    const rootBackupDir = backupDir || path.join(targetDir, BACKUP_DIR_NAME);

    if (!backupDir) {
      // First call - create backup directory if needed
      if (!fs.existsSync(rootBackupDir)) {
        await fs.promises.mkdir(rootBackupDir, { recursive: true });
        await setHiddenAttribute(rootBackupDir);
      }
    }

    // Read all files from source directory (files that will be installed)
    const entries = await readdir(sourceDir, { withFileTypes: true });
    let backedUpCount = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      const entryRelativePath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        // Recursively backup subdirectory
        await backupFiles(sourcePath, targetPath, rootBackupDir, entryRelativePath);
      } else {
        // Check if file exists in target directory
        if (fs.existsSync(targetPath)) {
          const backupPath = path.join(rootBackupDir, entryRelativePath);
          const backupFileDir = path.dirname(backupPath);

          // Only create backup if it doesn't exist (preserve original files)
          if (!fs.existsSync(backupPath)) {
            // Ensure backup subdirectory exists
            if (!fs.existsSync(backupFileDir)) {
              await fs.promises.mkdir(backupFileDir, { recursive: true });
            }

            await fs.promises.copyFile(targetPath, backupPath);
            console.log(`[Backup] Backed up: ${entryRelativePath}`);
            backedUpCount++;
          } else {
            console.log(`[Backup] Backup already exists, skipping: ${entryRelativePath}`);
          }
        }
      }
    }

    if (backedUpCount > 0 && !backupDir) {
      console.log(
        `[Backup] Backup completed: ${backedUpCount} files backed up to ${rootBackupDir}`
      );
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
    if (!fs.existsSync(backupDir)) {
      console.log(`[Restore] Backup directory does not exist: ${backupDir}`);
      return;
    }

    const entries = await readdir(backupDir, { withFileTypes: true });
    let restoredCount = 0;

    for (const entry of entries) {
      const backupPath = path.join(backupDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively restore subdirectory
        await restoreBackupLegacy(backupPath, targetPath);
      } else {
        // Check if backup file still exists before restoring
        if (!fs.existsSync(backupPath)) {
          console.warn(`[Restore] Backup file missing, skipping: ${entry.name}`);
          continue;
        }

        // Ensure target directory exists
        const targetDirPath = path.dirname(targetPath);
        if (!fs.existsSync(targetDirPath)) {
          await fs.promises.mkdir(targetDirPath, { recursive: true });
        }

        // Restore file
        await fs.promises.copyFile(backupPath, targetPath);
        console.log(`[Restore] Restored (legacy): ${entry.name}`);
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      console.log(`[Restore] Legacy restore completed: ${restoredCount} files`);
    }
  } catch (error) {
    console.error('[Restore] Error restoring backup:', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Restore files from backup with backward compatibility
 * Priority: 1) .littlebit-backup/ directory (new format)
 *           2) file_backup suffix (legacy in-place format)
 */
export async function restoreBackupNew(
  targetDir: string,
  installedFiles: string[]
): Promise<void> {
  try {
    let restoredCount = 0;
    const backupDir = path.join(targetDir, BACKUP_DIR_NAME);
    const hasBackupDir = fs.existsSync(backupDir);

    for (const relativePath of installedFiles) {
      const targetPath = path.join(targetDir, relativePath);

      // Try new format first (.littlebit-backup/ directory)
      if (hasBackupDir) {
        const newBackupPath = path.join(backupDir, relativePath);
        if (fs.existsSync(newBackupPath)) {
          // Ensure target directory exists (it may have been deleted during file cleanup)
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            await fs.promises.mkdir(targetDir, { recursive: true });
          }
          // Restore the original file from backup directory
          await fs.promises.copyFile(newBackupPath, targetPath);
          // Delete the backup file
          await unlink(newBackupPath);
          console.log(`[Restore] Restored: ${relativePath} (from backup dir)`);
          restoredCount++;
          continue;
        }
      }

      // Fall back to legacy format (file_backup suffix)
      const legacyBackupPath = targetPath + BACKUP_SUFFIX;
      if (fs.existsSync(legacyBackupPath)) {
        // Ensure target directory exists (it may have been deleted during file cleanup)
        const legacyTargetDir = path.dirname(targetPath);
        if (!fs.existsSync(legacyTargetDir)) {
          await fs.promises.mkdir(legacyTargetDir, { recursive: true });
        }
        // Restore the original file from legacy backup
        await fs.promises.copyFile(legacyBackupPath, targetPath);
        // Delete the backup file
        await unlink(legacyBackupPath);
        console.log(`[Restore] Restored: ${relativePath} (legacy format)`);
        restoredCount++;
      }
    }

    // Clean up empty backup directory
    if (hasBackupDir) {
      await cleanupEmptyDirectories(backupDir, backupDir);
      // Remove backup dir if empty
      try {
        const remaining = await readdir(backupDir);
        if (remaining.length === 0) {
          await fs.promises.rmdir(backupDir);
          console.log(`[Restore] Removed empty backup directory`);
        }
      } catch {
        // Ignore errors
      }
    }

    if (restoredCount > 0) {
      console.log(`[Restore] Restore completed: ${restoredCount} files restored`);
    }
  } catch (error) {
    console.error('[Restore] Error restoring backup:', error);
    throw new Error(
      `Помилка відновлення файлів: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clean up empty directories recursively
 * Skips backup directory to preserve backup structure
 */
export async function cleanupEmptyDirectories(
  dir: string,
  rootDir: string
): Promise<void> {
  try {
    if (!fs.existsSync(dir)) return;

    // Never clean up inside backup directory
    if (dir.includes(BACKUP_DIR_NAME) || path.basename(dir) === BACKUP_DIR_NAME) {
      return;
    }

    const entries = await readdir(dir, { withFileTypes: true });

    // Recursively clean subdirectories first (skip backup dir)
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== BACKUP_DIR_NAME) {
        const subDir = path.join(dir, entry.name);
        await cleanupEmptyDirectories(subDir, rootDir);
      }
    }

    // Check if directory is now empty (ignore backup dir when counting)
    const remainingEntries = await readdir(dir);
    const nonBackupEntries = remainingEntries.filter((e) => e !== BACKUP_DIR_NAME);
    if (nonBackupEntries.length === 0 && dir !== rootDir) {
      // Don't delete if only backup dir remains
      if (remainingEntries.length > 0) {
        return;
      }
      await fs.promises.rmdir(dir);
      console.log(`[Cleanup] Deleted empty directory: ${path.relative(rootDir, dir)}`);
    }
  } catch (error) {
    console.warn(`[Cleanup] Failed to cleanup directory ${dir}:`, error);
  }
}
