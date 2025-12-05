/**
 * Форматує байти в читабельний вигляд (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Форматує секунди в читабельний вигляд (MM:SS)
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  if (seconds < 1) return '< 1с';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
