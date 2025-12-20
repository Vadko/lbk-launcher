import fs from 'fs';

/**
 * Parse size string like "150.00 MB" to bytes (reverse of formatBytes)
 */
export function parseSizeToBytes(sizeString: string): number {
  const match = sizeString.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 0);
}

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
