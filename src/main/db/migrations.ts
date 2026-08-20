import type Database from 'better-sqlite3';
import { generateSearchableString, withStrippedVariant } from '../../shared/search-utils';

/**
 * Interface for migration
 */
interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

/** Додати колонку, якщо її ще нема (ідемпотентно) */
function addColumnIfMissing(db: Database.Database, column: string, ddl: string): void {
  const has = db
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name = ?")
    .get(column) as { count: number };
  if (has.count === 0) {
    console.log(`[Migrations] Adding column: ${column}`);
    db.exec(ddl);
  }
}

/**
 * Разовий примусовий повний ресинк: маркер-ключ мусить збігатися з історичним
 * байт-у-байт, інакше клієнти повторять ресинк.
 */
function forceResyncOnce(db: Database.Database, name: string, markerKey: string): void {
  const done = db
    .prepare('SELECT COUNT(*) as count FROM sync_metadata WHERE key = ?')
    .get(markerKey) as { count: number };
  if (done.count > 0) {
    return;
  }
  console.log(`[Migrations] Running: ${name}`);
  db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
  db.prepare(
    "INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, '1', datetime('now'))"
  ).run(markerKey);
  console.log(`[Migrations] Completed: ${name} - will resync on next startup`);
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
    up: (db) =>
      forceResyncOnce(
        db,
        'fix_archive_size_nan_values',
        'migration_fix_archive_size_done'
      ),
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
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_steam_app_id',
        'migration_resync_steam_app_id_done'
      ),
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
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_epic_archive',
        'migration_resync_epic_archive_done'
      ),
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
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_license_only',
        'migration_resync_license_only_done'
      ),
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
    up: (db) =>
      forceResyncOnce(db, 'resync_for_ai_and_hide', 'migration_resync_ai_hide_done'),
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
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_additional_path',
        'migration_resync_additional_path_done'
      ),
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
    up: (db) => forceResyncOnce(db, 'resync_for_fts5', 'migration_resync_fts5_done'),
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
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_capsule_path',
        'migration_resync_capsule_path_done'
      ),
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

      // Check if ai column is already TEXT (for new databases created with correct schema)
      const aiColumnInfo = db
        .prepare("SELECT type FROM pragma_table_info('games') WHERE name='ai'")
        .get() as { type: string } | undefined;

      if (aiColumnInfo?.type === 'TEXT') {
        // Column is already TEXT, just mark migration as done
        console.log('[Migrations] ai column is already TEXT, skipping change_ai_to_text');
        db.exec(`
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_ai_to_text_done', '1', datetime('now'))
        `);
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
          screenshots TEXT,
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
  {
    name: 'resync_for_ai_text_fix',
    up: (db) =>
      forceResyncOnce(db, 'resync_for_ai_text_fix', 'migration_resync_ai_text_fix_done'),
  },
  {
    name: 'resync_for_ai_migration_fix_v2',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_ai_migration_fix_v2',
        'migration_resync_ai_fix_v2_done'
      ),
  },
  {
    name: 'add_translation_updated_at_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='translation_updated_at'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_translation_updated_at_column');
        db.exec(`ALTER TABLE games ADD COLUMN translation_updated_at TEXT;`);
        console.log('[Migrations] Completed: add_translation_updated_at_column');
      }
    },
  },
  {
    name: 'resync_for_translation_updated_at',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_translation_updated_at',
        'migration_resync_translation_updated_at_done'
      ),
  },
  {
    name: 'add_spellfix_words',
    up: (db) => {
      // Check if spellfix_words already exists
      const tableExists = db
        .prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='spellfix_words'"
        )
        .get() as { count: number };

      if (tableExists.count > 0) {
        return;
      }

      // Only create if spellfix1 extension is loaded
      try {
        db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS spellfix_words USING spellfix1;
        `);
        console.log('[Migrations] Completed: add_spellfix_words');
      } catch {
        console.log(
          '[Migrations] Spellfix1 not available, skipping spellfix_words table'
        );
      }
    },
  },
  {
    name: 'populate_spellfix_words',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_populate_spellfix_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      // Check if spellfix_words table exists
      const tableExists = db
        .prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='spellfix_words'"
        )
        .get() as { count: number };

      if (tableExists.count === 0) {
        return;
      }

      console.log('[Migrations] Running: populate_spellfix_words');

      // Inline spellfix population (can't import db-queries due to bundled code)
      const rows = db
        .prepare('SELECT name FROM games WHERE approved = 1 AND hide = 0')
        .all() as { name: string }[];

      const words = new Set<string>();
      for (const row of rows) {
        for (const word of row.name.toLowerCase().split(/\s+/)) {
          const cleaned = word.replace(/[^a-zа-яіїєґ0-9]/gi, '').toLowerCase();
          if (cleaned.length >= 3) {
            words.add(cleaned);
          }
        }
      }

      db.exec('DELETE FROM spellfix_words');
      const insertStmt = db.prepare('INSERT INTO spellfix_words(word) VALUES (?)');
      for (const word of words) {
        insertStmt.run(word);
      }
      console.log(`[Migrations] Spellfix dictionary: ${words.size} words`);

      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_populate_spellfix_done', '1', datetime('now'))
      `);

      console.log('[Migrations] Completed: populate_spellfix_words');
    },
  },
  {
    name: 'add_search_keywords_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='search_keywords'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_search_keywords_column');
        db.exec('ALTER TABLE games ADD COLUMN search_keywords TEXT;');
        console.log('[Migrations] Completed: add_search_keywords_column');
      }
    },
  },
  {
    name: 'add_search_keywords_to_fts',
    up: (db) => {
      // Check if already done
      const done = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_search_keywords_fts_done'"
        )
        .get() as { count: number };

      if (done.count > 0) {
        return;
      }

      console.log('[Migrations] Running: add_search_keywords_to_fts');

      // FTS5 tables can't be ALTERed, need to recreate
      db.exec(`
        DROP TABLE IF EXISTS games_fts;
        CREATE VIRTUAL TABLE games_fts USING fts5(
          game_id UNINDEXED,
          name_search,
          search_keywords,
          tokenize='unicode61'
        );
      `);

      // Repopulate FTS from games table
      const games = db
        .prepare('SELECT id, name_search, search_keywords FROM games')
        .all() as { id: string; name_search: string; search_keywords: string | null }[];
      const insertStmt = db.prepare(
        'INSERT INTO games_fts (game_id, name_search, search_keywords) VALUES (?, ?, ?)'
      );
      for (const game of games) {
        insertStmt.run(game.id, game.name_search, game.search_keywords);
      }

      // Force full re-sync to fetch search_keywords from Supabase
      db.exec(`DELETE FROM sync_metadata WHERE key = 'last_sync_timestamp'`);
      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_search_keywords_fts_done', '1', datetime('now'))
      `);

      console.log(
        `[Migrations] Completed: add_search_keywords_to_fts (${games.length} games reindexed, full re-sync scheduled)`
      );
    },
  },
  {
    name: 'add_source_language_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='source_language'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_source_language_column');
        db.exec('ALTER TABLE games ADD COLUMN source_language TEXT;');
        console.log('[Migrations] Completed: add_source_language_column');
      }
    },
  },
  {
    name: 'add_gog_archive_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='gog_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_gog_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN gog_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN gog_archive_path TEXT;
          ALTER TABLE games ADD COLUMN gog_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_gog_archive_columns');
      }
    },
  },
  {
    name: 'add_steam_linux_archive_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='steam_linux_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_steam_linux_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN steam_linux_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN steam_linux_archive_path TEXT;
          ALTER TABLE games ADD COLUMN steam_linux_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_steam_linux_archive_columns');
      }
    },
  },
  {
    name: 'add_steam_mac_archive_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='steam_mac_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_steam_mac_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN steam_mac_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN steam_mac_archive_path TEXT;
          ALTER TABLE games ADD COLUMN steam_mac_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_steam_mac_archive_columns');
      }
    },
  },
  {
    name: 'resync_for_steam_os_archives',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_steam_os_archives',
        'migration_resync_steam_os_archives_done'
      ),
  },
  {
    name: 'add_xbox_archive_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='xbox_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_xbox_archive_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN xbox_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN xbox_archive_path TEXT;
          ALTER TABLE games ADD COLUMN xbox_archive_size TEXT;
        `);
        console.log('[Migrations] Completed: add_xbox_archive_columns');
      }
    },
  },
  {
    name: 'resync_for_gog_xbox_archives',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_gog_xbox_archives',
        'migration_resync_gog_xbox_archives_done'
      ),
  },
  {
    name: 'add_steam_launch_options_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='steam_launch_options_windows'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_steam_launch_options_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN steam_launch_options_windows TEXT;
          ALTER TABLE games ADD COLUMN steam_launch_options_linux TEXT;
        `);
        console.log('[Migrations] Completed: add_steam_launch_options_columns');
      }
    },
  },
  {
    name: 'resync_for_steam_launch_options',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_steam_launch_options',
        'migration_resync_steam_launch_options_done'
      ),
  },
  {
    name: 'add_screenshots_column',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='screenshots'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_screenshots_column');
        db.exec(`ALTER TABLE games ADD COLUMN screenshots TEXT;`);
        console.log('[Migrations] Completed: add_screenshots_column');
      }
    },
  },
  {
    name: 'resync_for_screenshots',
    up: (db) =>
      forceResyncOnce(db, 'resync_for_screenshots', 'migration_resync_screenshots_done'),
  },
  {
    name: 'add_store_url_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='epic_store_url'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_store_url_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN epic_store_url TEXT;
          ALTER TABLE games ADD COLUMN gog_store_url TEXT;
          ALTER TABLE games ADD COLUMN xbox_store_url TEXT;
        `);
        console.log('[Migrations] Completed: add_store_url_columns');
      }
    },
  },
  {
    name: 'resync_for_store_urls',
    up: (db) =>
      forceResyncOnce(db, 'resync_for_store_urls', 'migration_resync_store_urls_done'),
  },
  {
    name: 'add_uplay_ea_store_columns',
    up: (db) => {
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='uplay_archive_path'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_uplay_ea_store_columns');
        db.exec(`
          ALTER TABLE games ADD COLUMN uplay_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN uplay_archive_path TEXT;
          ALTER TABLE games ADD COLUMN uplay_archive_size TEXT;
          ALTER TABLE games ADD COLUMN ea_archive_hash TEXT;
          ALTER TABLE games ADD COLUMN ea_archive_path TEXT;
          ALTER TABLE games ADD COLUMN ea_archive_size TEXT;
          ALTER TABLE games ADD COLUMN uplay_store_url TEXT;
          ALTER TABLE games ADD COLUMN ea_store_url TEXT;
        `);
        console.log('[Migrations] Completed: add_uplay_ea_store_columns');
      }
    },
  },
  {
    name: 'resync_for_uplay_ea_stores',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_uplay_ea_stores',
        'migration_resync_uplay_ea_stores_done'
      ),
  },
  {
    name: 'add_user_unlocked_column',
    up: (db) => {
      // Local-only column: tracks games the user manually unlocked via a translation
      // code. Never populated from Supabase, so no resync is needed - and crucially,
      // it must survive the sync upsert (see UPSERT_GAME_SQL switch to ON CONFLICT
      // DO UPDATE) instead of being wiped by the old INSERT OR REPLACE behavior.
      const hasColumn = db
        .prepare(
          "SELECT COUNT(*) as count FROM pragma_table_info('games') WHERE name='user_unlocked'"
        )
        .get() as { count: number };

      if (hasColumn.count === 0) {
        console.log('[Migrations] Running: add_user_unlocked_column');
        db.exec(`ALTER TABLE games ADD COLUMN user_unlocked INTEGER NOT NULL DEFAULT 0;`);
        console.log('[Migrations] Completed: add_user_unlocked_column');
      }
    },
  },
  {
    name: 'reindex_fts_without_apostrophes',
    up: (db) => {
      const migrationDone = db
        .prepare(
          "SELECT COUNT(*) as count FROM sync_metadata WHERE key = 'migration_reindex_fts_apostrophes_done'"
        )
        .get() as { count: number };

      if (migrationDone.count > 0) {
        return;
      }

      console.log('[Migrations] Running: reindex_fts_without_apostrophes');

      // Індекс перебудовуємо локально з наявних рядків — на відміну від решти
      // resync_* міграцій, тут нічого не треба заново тягнути з Supabase.
      const rows = db.prepare('SELECT id, name, search_keywords FROM games').all() as {
        id: string;
        name: string;
        search_keywords: string | null;
      }[];

      const reindex = db.transaction(() => {
        const updateStmt = db.prepare('UPDATE games SET name_search = ? WHERE id = ?');
        const insertStmt = db.prepare(
          'INSERT INTO games_fts (game_id, name_search, search_keywords) VALUES (?, ?, ?)'
        );

        db.exec('DELETE FROM games_fts');

        for (const row of rows) {
          const nameSearch = generateSearchableString(row.name);
          updateStmt.run(nameSearch, row.id);
          insertStmt.run(
            row.id,
            nameSearch,
            row.search_keywords ? withStrippedVariant(row.search_keywords) : null
          );
        }
      });

      reindex();

      db.exec(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES ('migration_reindex_fts_apostrophes_done', '1', datetime('now'))
      `);

      console.log(
        `[Migrations] Completed: reindex_fts_without_apostrophes (${rows.length} games)`
      );
    },
  },
  {
    name: 'add_steam_tag_ids_column',
    up: (db) =>
      addColumnIfMissing(
        db,
        'steam_tag_ids',
        'ALTER TABLE games ADD COLUMN steam_tag_ids TEXT;'
      ),
  },
  {
    name: 'resync_for_steam_tag_ids',
    up: (db) =>
      forceResyncOnce(
        db,
        'resync_for_steam_tag_ids',
        'migration_resync_steam_tag_ids_done'
      ),
  },
  {
    name: 'add_workshop_games_table',
    up: (db) => {
      const tableExists = db
        .prepare(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='workshop_games'"
        )
        .get() as { count: number };
      if (tableExists.count > 0) {
        return;
      }

      console.log('[Migrations] Running: add_workshop_games_table');

      db.exec(`
        CREATE TABLE IF NOT EXISTS workshop_games (
          id TEXT PRIMARY KEY,
          workshop_id TEXT NOT NULL,
          steam_app_id INTEGER,
          name TEXT NOT NULL,
          name_search TEXT,
          team TEXT,
          game_name TEXT,
          thumbnail_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_workshop_games_name_search ON workshop_games(name_search);
      `);

      console.log('[Migrations] Completed: add_workshop_games_table');
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
