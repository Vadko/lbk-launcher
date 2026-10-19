import fs from 'fs';

/**
 * Check available disk space
 */
export async function checkDiskSpace(targetPath: string): Promise<number> {
  try {
    if (!targetPath) {
      console.warn('[DiskSpace] No target path provided, skipping disk space check');
      return Number.MAX_SAFE_INTEGER;
    }
    const stats = await fs.promises.statfs(targetPath);
    // Available space = block size * available blocks
    return stats.bavail * stats.bsize;
  } catch (error) {
    console.error('[DiskSpace] Error checking disk space:', error);
    // Return a large number to not block installation if we can't check
    return Number.MAX_SAFE_INTEGER;
  }
}
