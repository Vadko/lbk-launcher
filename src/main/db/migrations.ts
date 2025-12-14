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
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='voice_archive_path'"
        )
        .get() as { count: number };

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
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='achievements_archive_path'"
        )
        .get() as { count: number };

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
  {
    name: 'add_subscriptions_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='subscriptions'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_subscriptions_column');
        db.exec(`ALTER TABLE games ADD COLUMN subscriptions INTEGER;`);
        console.log('[Migrations] Completed: add_subscriptions_column');
      }
    },
  },
  {
    name: 'fix_archive_size_nan_values',
    up: (db) => {
      // Check if this migration was already run by looking for marker in sync_metadata
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_fix_archive_size_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return; // Already done
      }

      // Fix archive_size values that were incorrectly converted to NaN
      // This happened because Number("150.00 MB") returns NaN
      // Force full resync to get correct string values from Supabase
      console.log('[Migrations] Running: fix_archive_size_nan_values');

      // Reset sync metadata to force full resync
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);

      // Mark migration as done
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_fix_archive_size_done', '1', datetime('now'))
      `);

      console.log(
        '[Migrations] Completed: fix_archive_size_nan_values - will resync on next startup'
      );
    },
  },
  {
    name: 'add_steam_app_id_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='steam_app_id'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_steam_app_id_column');
        db.exec(`ALTER TABLE games ADD COLUMN steam_app_id INTEGER;`);
        console.log('[Migrations] Completed: add_steam_app_id_column');
      }
    },
  },
  {
    name: 'resync_for_steam_app_id',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_steam_app_id_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_steam_app_id');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_steam_app_id_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_steam_app_id - will resync on next startup'
      );
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
