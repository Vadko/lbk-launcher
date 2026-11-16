import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { t } from '@/shared/i18n/i18n';
import { isMacOS, isWindows } from '../utils/platform';
import { BACKUP_DIR_NAME, BACKUP_DIR_NAME_LEGACY } from './backup';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

/**
 * Get list of all files in directory recursively (relative paths)
 */
export async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively get files from subdirectory
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      // Store relative path
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

async function executableBitsFor(destPath: string): Promise<number> {
  if (isWindows()) {
    return 0;
  }
  const parent = path.dirname(destPath);
  const inBundleBinDir =
    path.basename(parent) === 'MacOS' &&
    path.basename(path.dirname(parent)) === 'Contents';
  let bits = isMacOS() && inBundleBinDir ? 0o111 : 0;
  try {
    bits |= (await fs.promises.stat(destPath)).mode & 0o111;
  } catch (error) {
    // ENOENT is the normal path: the file isn't in the game yet, so there are no bits to inherit
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      console.warn(`[Installer] Could not read permissions for ${destPath}:`, error);
    }
  }
  return bits;
}

/**
 * Copy directory recursively
 */
export async function copyDirectory(source: string, destination: string): Promise<void> {
  try {
    // Create destination directory
    await mkdir(destination, { recursive: true });

    // Read source directory
    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        await copyDirectory(sourcePath, destPath);
      } else {
        const execBits = await executableBitsFor(destPath);
        await fs.promises.copyFile(sourcePath, destPath);
        if (execBits) {
          const { mode } = await fs.promises.stat(destPath);
          await fs.promises.chmod(destPath, (mode & 0o7777) | execBits);
        }
      }
    }

    console.log(`Copied files from ${source} to ${destination}`);
  } catch (error) {
    throw new Error(
      t('installFailure.copyFailed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
}

/**
 * Cleanup temporary files
 */
export async function cleanupDownloadDir(downloadDir: string): Promise<void> {
  try {
    // Delete entire download directory with all archives and extracted files
    if (fs.existsSync(downloadDir)) {
      await deleteDirectory(downloadDir);
    }

    console.log('Cleanup completed');
  } catch (error) {
    console.warn('Cleanup warning:', error);
    // Don't throw error on cleanup failure
  }
}

/**
 * Delete directory recursively
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await deleteDirectory(fullPath);
    } else {
      await unlink(fullPath);
    }
  }

  await fs.promises.rmdir(dirPath);
}

// Walks up removing parents left empty, stopping at `rootDir` or the backup directory.
export async function deleteFileAndCleanupDirs(
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
