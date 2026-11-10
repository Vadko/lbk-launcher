import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrations';

// The games table as change_ai_to_text left it; later migrations add the rest
const BASE_COLUMNS = [
  'approved',
  'name',
  'name_search',
  'platforms',
  'slug',
  'status',
  'team',
  'ai TEXT',
  'hide',
];

// A database of the previous release: fully migrated, minus this change
function legacyDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE games (id TEXT PRIMARY KEY, ${BASE_COLUMNS.join(', ')});
    CREATE TABLE sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO games (id, name, approved, hide) VALUES ('a', 'Game', 1, 0);
  `);
  runMigrations(db);
  db.exec(`
    ALTER TABLE games DROP COLUMN artwork_localized;
    DELETE FROM sync_metadata WHERE key = 'migration_resync_artwork_localized_done';
    INSERT INTO sync_metadata VALUES ('last_sync_timestamp', '2026-01-01', '2026-01-01');
  `);
  return db;
}

const artworkLocalized = (db: Database.Database) =>
  db.prepare('SELECT artwork_localized FROM games WHERE id = ?').pluck().get('a');

const lastSync = (db: Database.Database) =>
  db
    .prepare("SELECT value FROM sync_metadata WHERE key = 'last_sync_timestamp'")
    .pluck()
    .get();

describe('artwork_localized migration', () => {
  it('keeps offering artwork on existing rows until the forced resync replaces them', () => {
    const db = legacyDb();

    runMigrations(db);

    expect(artworkLocalized(db)).toBe(1);
    expect(lastSync(db)).toBeUndefined();
  });

  it('leaves the synced value and the sync cursor alone on later starts', () => {
    const db = legacyDb();
    runMigrations(db);
    db.exec(`
      UPDATE games SET artwork_localized = 0;
      INSERT INTO sync_metadata VALUES ('last_sync_timestamp', '2026-02-02', '2026-02-02');
    `);

    runMigrations(db);

    expect(artworkLocalized(db)).toBe(0);
    expect(lastSync(db)).toBe('2026-02-02');
  });
});
