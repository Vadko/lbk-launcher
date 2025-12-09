import type Database from 'better-sqlite3';

/**
 * Interface for migration
 */
interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * All migrations in order of execution
 * Each migration should be idempotent (can be run multiple times safely)
 */
const migrations: Migration[] = [
  {
    name: 'add_voice_archive_columns',
    up: (db) => {
      const hasColumn = db.prepare(
        "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='voice_archive_path'"
      ).get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_voice_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN voice_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN voice_archive_path TEXT;
          ALTER TABLE games ADD COLUMN voice_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_voice_archive_columns');
      }
    },
  },
  {
    name: 'add_achievements_archive_columns',
    up: (db) => {
      const hasColumn = db.prepare(
        "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='achievements_archive_path'"
      ).get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_achievements_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN achievements_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN achievements_archive_path TEXT;
          ALTER TABLE games ADD COLUMN achievements_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_achievements_archive_columns');
      }
    },
  },
];

/**
 * Run all migrations
 * Each migration checks if it needs to run before executing
 */
export function runMigrations(db: Database.Database): void {
  console.log('[Migrations] Starting migrations...');

  for (const migration of migrations) {
    try {
      migration.up(db);
    } catch (error) {
      console.error(`[Migrations] Error running migration ${migration.name}:`, error);
      throw error;
    }
  }

  console.log('[Migrations] All migrations completed');
}
