/**
 * Formats bytes into a readable form (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

// Catalog sizes are strings like "150.00 MB"; anything else counts as 0.
export function parseSizeToBytes(sizeString: string): number {
  const match = sizeString.trim().match(/([\d.]+)\s*(B|KB|MB|GB)/i);
  return match ? parseFloat(match[1]) * SIZE_UNITS[match[2].toUpperCase()] : 0;
}

/**
 * Formats seconds into a readable form (MM:SS)
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '--:--';
  }
  if (seconds < 1) {
    return '< 1с';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
