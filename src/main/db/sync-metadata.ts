import { getDatabase } from './database';

export function getSyncMetadata(key: string): string | null {
  const row = getDatabase()
    .prepare('SELECT value FROM sync_metadata WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSyncMetadata(key: string, value: string): void {
  getDatabase()
    .prepare(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    )
    .run(key, value);
}
