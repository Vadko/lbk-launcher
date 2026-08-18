import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// A read-only schema makes Steam's overwrite fail ("failed to write schema to
// disk"), so the installed localization survives. On Windows fs.chmod does not
// reliably set the read-only file attribute in a packaged app, so use attrib.exe
// (which held in manual testing); on POSIX use chmod, preserving other bits.

/** Lock a schema file read-only so Steam cannot overwrite it. */
export async function lockSchemaFile(filePath: string): Promise<void> {
  try {
    if (process.platform === 'win32') {
      await execFileAsync('attrib', ['+R', filePath]);
    } else {
      const { mode } = await fs.promises.stat(filePath);
      await fs.promises.chmod(filePath, mode & ~0o222);
    }
    // Verify the read-only bit actually took effect (fs.stat mode reflects the
    // Windows read-only attribute too) and make the outcome visible in the log.
    const { mode } = await fs.promises.stat(filePath);
    if (mode & 0o200) {
      console.warn(`[SchemaLock] Lock did NOT take effect (still writable): ${filePath}`);
    } else {
      console.log(`[SchemaLock] Locked read-only: ${filePath}`);
    }
  } catch (error) {
    console.warn(`[SchemaLock] Failed to lock ${filePath}:`, error);
  }
}

/** Unlock before any write/rename/unlink of a schema file. No-op if missing. */
export async function unlockSchemaFile(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;
    if (process.platform === 'win32') {
      await execFileAsync('attrib', ['-R', filePath]);
    } else {
      const { mode } = await fs.promises.stat(filePath);
      await fs.promises.chmod(filePath, mode | 0o200);
    }
  } catch (error) {
    console.warn(`[SchemaLock] Failed to unlock ${filePath}:`, error);
  }
}
