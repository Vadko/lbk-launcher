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

// A database of a previous release: fully migrated, then the given change undone
function migratedDb(undo: string): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE games (id TEXT PRIMARY KEY, ${BASE_COLUMNS.join(', ')});
    CREATE TABLE sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO games (id, name, approved, hide) VALUES ('a', 'Game', 1, 0);
  `);
  runMigrations(db);
  db.exec(undo);
  return db;
}

const legacyDb = () =>
  migratedDb(`
    ALTER TABLE games DROP COLUMN artwork_localized;
    DELETE FROM sync_metadata WHERE key = 'migration_resync_artwork_localized_done';
    INSERT INTO sync_metadata VALUES ('last_sync_timestamp', '2026-01-01', '2026-01-01');
  `);

const metadata = (db: Database.Database, key: string) =>
  db.prepare('SELECT value FROM sync_metadata WHERE key = ?').pluck().get(key);

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

describe('downloads_30d migration', () => {
  const before30d = () =>
    migratedDb(`
      ALTER TABLE games DROP COLUMN downloads_30d;
      INSERT INTO sync_metadata VALUES ('game_counters_synced_at', '2026-01-01', '2026-01-01');
      INSERT INTO sync_metadata VALUES ('last_sync_timestamp', '2026-01-01', '2026-01-01');
    `);

  it('adds the column and refetches every counter, without a games resync', () => {
    const db = before30d();

    runMigrations(db);

    expect(
      db.prepare('SELECT downloads_30d FROM games WHERE id = ?').pluck().get('a')
    ).toBe(0);
    expect(metadata(db, 'game_counters_synced_at')).toBeUndefined();
    expect(metadata(db, 'last_sync_timestamp')).toBe('2026-01-01');
  });

  it('keeps the counters cursor on later starts', () => {
    const db = before30d();
    runMigrations(db);
    db.exec(
      "INSERT INTO sync_metadata VALUES ('game_counters_synced_at', '2026-02-02', '2026-02-02')"
    );

    runMigrations(db);

    expect(metadata(db, 'game_counters_synced_at')).toBe('2026-02-02');
  });
});
