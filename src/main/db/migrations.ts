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
  {
    name: 'add_epic_archive_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='epic_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_epic_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN epic_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN epic_archive_path TEXT;
          ALTER TABLE games ADD COLUMN epic_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_epic_archive_columns');
      }
    },
  },
  {
    name: 'resync_for_epic_archive',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_epic_archive_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_epic_archive');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_epic_archive_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_epic_archive - will resync on next startup'
      );
    },
  },
  {
    name: 'add_license_only_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='license_only'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_license_only_column');
        db.exec(`ALTER TABLE games ADD COLUMN license_only INTEGER NOT NULL DEFAULT 0;`);
        console.log('[Migrations] Completed: add_license_only_column');
      }
    },
  },
  {
    name: 'resync_for_license_only',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_license_only_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_license_only');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_license_only_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_license_only - will resync on next startup'
      );
    },
  },
  {
    name: 'add_ai_and_hide_columns',
    up: (db) => {
      const hasAiColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='ai'"
        )
        .get() as { count: number };

      if (hasAiColumn.count === 0) {
        console.log('[Migrations] Running: add_ai_and_hide_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN ai INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE games ADD COLUMN hide INTEGER NOT NULL DEFAULT 0;
          CREATE INDEX IF NOT EXISTS idx_games_hide ON games(hide);
        `);
        console.log('[Migrations] Completed: add_ai_and_hide_columns');
      }
    },
  },
  {
    name: 'resync_for_ai_and_hide',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_ai_hide_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_ai_and_hide');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_ai_hide_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_ai_and_hide - will resync on next startup'
      );
    },
  },
  {
    name: 'add_additional_path_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='additional_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_additional_path_column');
        db.exec(`ALTER TABLE games ADD COLUMN additional_path TEXT;`);
        console.log('[Migrations] Completed: add_additional_path_column');
      }
    },
  },
  {
    name: 'resync_for_additional_path',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_additional_path_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_additional_path');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_additional_path_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_additional_path - will resync on next startup'
      );
    },
  },
  {
    name: 'add_name_search_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='name_search'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_name_search_column');
        db.exec(`
          ALTER TABLE games ADD COLUMN name_search TEXT;
          CREATE INDEX IF NOT EXISTS idx_games_name_search ON games(name_search);
        `);
        console.log('[Migrations] Completed: add_name_search_column');
      }
    },
  },
  {
    name: 'add_fts5_search',
    up: (db) => {
      // Check if FTS table already exists
      const tableExists = db
        .prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='games_fts'"
        )
        .get() as { count: number };

      if (tableExists.count > 0) {
        return;
      }

      console.log('[Migrations] Running: add_fts5_search');

      // Create FTS5 virtual table for full-text search
      db.exec(`
        CREATE VIRTUAL TABLE games_fts USING fts5(
          game_id UNINDEXED,
          name_search,
          tokenize='unicode61'
        );
      `);

      console.log('[Migrations] Completed: add_fts5_search');
    },
  },
  {
    name: 'resync_for_fts5',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_fts5_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_fts5');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_fts5_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_fts5 - will resync on next startup'
      );
    },
  },
  {
    name: 'add_achievements_third_party_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='achievements_third_party'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_achievements_third_party_column');
        db.exec(`ALTER TABLE games ADD COLUMN achievements_third_party TEXT;`);
        console.log('[Migrations] Completed: add_achievements_third_party_column');
      }
    },
  },
  {
    name: 'resync_for_achievements_third_party',
    up: (db) => {
      const done = db
        .prepare(
          "SELECT value FROM sync_metadata WHERE key = 'migration_resync_achievements_third_party_done'"
        )
        .get() as { value: string } | undefined;

      if (!done) {
        console.log('[Migrations] Running: resync_for_achievements_third_party');
        db.exec(`
          UPDATE sync_metadata SET value = '' WHERE key = 'last_sync';
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_resync_achievements_third_party_done', '1', datetime('now'))
        `);
        console.log('[Migrations] Completed: resync_for_achievements_third_party');
      }
    },
  },
  {
    name: 'add_capsule_path_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='capsule_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_capsule_path_column');
        db.exec(`ALTER TABLE games ADD COLUMN capsule_path TEXT;`);
        console.log('[Migrations] Completed: add_capsule_path_column');
      }
    },
  },
  {
    name: 'resync_for_capsule_path',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_resync_capsule_path_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: resync_for_capsule_path');
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_resync_capsule_path_done', '1', datetime('now'))
      `);
      console.log(
        '[Migrations] Completed: resync_for_capsule_path - will resync on next startup'
      );
    },
  },
  {
    name: 'change_ai_to_text',
    up: (db) => {
      // Check if migration is already done
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_ai_to_text_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: change_ai_to_text');

      // SQLite doesn't support ALTER COLUMN to remove NOT NULL constraint
      // We need to recreate the table with the correct schema
      // This is safe because launcher data is always synced from server

      db.exec(`
        PRAGMA foreign_keys = OFF;

        -- Create new table with ai as TEXT (nullable)
        CREATE TABLE games_new (
          id TEXT PRIMARY KEY,
          approved INTEGER NOT NULL DEFAULT 0,
          approved_at TEXT,
          approved_by TEXT,
          archive_hash TEXT,
          archive_path TEXT,
          archive_size TEXT,
          banner_path TEXT,
          capsule_path TEXT,
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          description TEXT,
          discord TEXT,
          downloads INTEGER,
          subscriptions INTEGER,
          editing_progress INTEGER NOT NULL DEFAULT 0,
          fonts_progress INTEGER,
          fundraising_current INTEGER,
          fundraising_goal INTEGER,
          game_description TEXT,
          install_paths TEXT,
          installation_file_linux_path TEXT,
          installation_file_windows_path TEXT,
          is_adult INTEGER NOT NULL DEFAULT 0,
          license_only INTEGER NOT NULL DEFAULT 0,
          logo_path TEXT,
          name TEXT NOT NULL,
          name_search TEXT,
          platforms TEXT NOT NULL,
          project_id TEXT,
          slug TEXT NOT NULL,
          status TEXT NOT NULL,
          support_url TEXT,
          team TEXT NOT NULL,
          telegram TEXT,
          textures_progress INTEGER,
          thumbnail_path TEXT,
          translation_progress INTEGER NOT NULL DEFAULT 0,
          twitter TEXT,
          updated_at TEXT NOT NULL,
          version TEXT,
          video_url TEXT,
          voice_archive_hash TEXT,
          voice_archive_path TEXT,
          voice_archive_size TEXT,
          voice_progress INTEGER,
          achievements_archive_hash TEXT,
          achievements_archive_path TEXT,
          achievements_archive_size TEXT,
          achievements_third_party TEXT,
          additional_path TEXT,
          steam_app_id INTEGER,
          website TEXT,
          youtube TEXT,
          epic_archive_hash TEXT,
          epic_archive_path TEXT,
          epic_archive_size TEXT,
          ai TEXT,
          hide INTEGER NOT NULL DEFAULT 0
        );

        -- Copy data, converting ai: 0 -> NULL, 1 -> 'edited'
        INSERT INTO games_new SELECT
          id, approved, approved_at, approved_by, archive_hash, archive_path, archive_size,
          banner_path, capsule_path, created_at, created_by, description, discord, downloads,
          subscriptions, editing_progress, fonts_progress, fundraising_current, fundraising_goal,
          game_description, install_paths, installation_file_linux_path, installation_file_windows_path,
          is_adult, license_only, logo_path, name, name_search, platforms, project_id, slug, status,
          support_url, team, telegram, textures_progress, thumbnail_path, translation_progress,
          twitter, updated_at, version, video_url, voice_archive_hash, voice_archive_path,
          voice_archive_size, voice_progress, achievements_archive_hash, achievements_archive_path,
          achievements_archive_size, achievements_third_party, additional_path, steam_app_id,
          website, youtube, epic_archive_hash, epic_archive_path, epic_archive_size,
          CASE WHEN ai = 1 THEN 'edited' ELSE NULL END,
          hide
        FROM games;

        -- Drop old table and rename new
        DROP TABLE games;
        ALTER TABLE games_new RENAME TO games;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
        CREATE INDEX IF NOT EXISTS idx_games_name_search ON games(name_search);
        CREATE INDEX IF NOT EXISTS idx_games_approved ON games(approved);
        CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
        CREATE INDEX IF NOT EXISTS idx_games_is_adult ON games(is_adult);
        CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
        CREATE INDEX IF NOT EXISTS idx_games_hide ON games(hide);

        PRAGMA foreign_keys = ON;
      `);

      // Mark migration as done and force resync to get fresh data
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_ai_to_text_done', '1', datetime('now'))
      `);

      console.log(
        '[Migrations] Completed: change_ai_to_text - table recreated, will resync on next startup'
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
