import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { runMigrations } from './migrations';

/**
 * Database Manager - клас для управління локальною базою даних
 */
class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database.Database;

  private constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = join(userDataPath, 'lbk.db');

    // Check if DB was marked for deletion on previous run (clear cache)
    const deleteMarkerPath = join(userDataPath, 'lbk.db.delete');
    if (existsSync(deleteMarkerPath)) {
      console.log('[Database] Found delete marker, removing database files...');
      try {
        unlinkSync(deleteMarkerPath);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(dbPath);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(`${dbPath}-wal`);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(`${dbPath}-shm`);
      } catch {
        /* ignore */
      }
      console.log('[Database] Database files removed');
    }

    const dbExists = existsSync(dbPath);

    if (dbExists) {
      console.log('[Database] Opening existing database at:', dbPath);
    } else {
      console.log('[Database] Creating new database at:', dbPath);
    }

    this.db = new Database(dbPath);

    // Увімкнути WAL режим для кращої продуктивності
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Load spellfix1 extension for fuzzy search
    this.loadSpellfixExtension();

    // Створити таблиці якщо їх немає
    if (!dbExists) {
      this.createTables();
      console.log('[Database] Database created successfully');
    } else {
      // Перевірити чи таблиці існують, якщо ні - створити
      const tablesExist = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='games'")
        .get();
      if (!tablesExist) {
        this.createTables();
        console.log('[Database] Tables created successfully');
      } else {
        // Run migrations for existing databases
        runMigrations(this.db);
      }
    }
  }

  /**
   * Load spellfix1 extension for typo-tolerant search
   */
  private loadSpellfixExtension(): void {
    try {
      const extPath = getSpellfixPath();
      if (!extPath) {
        console.log('[Database] Spellfix1 extension not found, fuzzy search disabled');
        return;
      }
      // loadExtension expects path without file extension
      const extWithoutExt = extPath.replace(/\.(dylib|so|dll)$/, '');
      this.db.loadExtension(extWithoutExt);
      console.log('[Database] Spellfix1 extension loaded successfully');
    } catch (e) {
      console.warn('[Database] Spellfix1 extension not available:', e);
    }
  }

  /**
   * Singleton pattern для отримання єдиного екземпляру
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Отримати Database інстанс
   */
  public getDb(): Database.Database {
    return this.db;
  }

  /**
   * Створення таблиць - структура співпадає з Supabase
   * ВАЖЛИВО: При додаванні нових колонок тут, також додайте міграцію для існуючих БД!
   */
  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
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
        install_paths TEXT, -- JSON array
        installation_file_linux_path TEXT,
        installation_file_windows_path TEXT,
        is_adult INTEGER NOT NULL DEFAULT 0,
        license_only INTEGER NOT NULL DEFAULT 0,
        logo_path TEXT,
        name TEXT NOT NULL,
        name_search TEXT, -- For FTS search
        platforms TEXT NOT NULL, -- JSON array
        project_id TEXT,
        slug TEXT NOT NULL,
        status TEXT NOT NULL,
        support_url TEXT,
        team TEXT NOT NULL,
        telegram TEXT,
        textures_progress INTEGER,
        thumbnail_path TEXT,
        translation_progress INTEGER NOT NULL DEFAULT 0,
        translation_updated_at TEXT,
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

      CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
      CREATE INDEX IF NOT EXISTS idx_games_name_search ON games(name_search);
      CREATE INDEX IF NOT EXISTS idx_games_approved ON games(approved);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
      CREATE INDEX IF NOT EXISTS idx_games_is_adult ON games(is_adult);
      CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at);
      CREATE INDEX IF NOT EXISTS idx_games_hide ON games(hide);

      -- FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts5(
        game_id UNINDEXED,
        name_search,
        tokenize='unicode61'
      );
    `);

    // Spellfix1 virtual table for fuzzy search (if extension loaded)
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS spellfix_words USING spellfix1;
      `);
    } catch {
      console.log('[Database] Spellfix1 not available, skipping spellfix_words table');
    }

    // Таблиця для sync метаданих
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  /**
   * Закрити з'єднання з базою даних
   */
  public close(): void {
    if (this.db) {
      try {
        // Checkpoint WAL to ensure all data is written to main DB file
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignore checkpoint errors
      }
      this.db.close();
      this.db = null as unknown as Database.Database;
      DatabaseManager.instance = null;
      console.log('[Database] Database connection closed');
    }
  }
}

/**
 * Helper функція для отримання Database інстансу
 */
export function getDatabase(): Database.Database {
  return DatabaseManager.getInstance().getDb();
}

/**
 * Helper функція для ініціалізації БД
 */
export function initDatabase(): Database.Database {
  return DatabaseManager.getInstance().getDb();
}

/**
 * Helper функція для закриття БД
 */
export function closeDatabase(): void {
  DatabaseManager.getInstance().close();
}

/**
 * Get database file path
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'lbk.db');
}

/**
 * Get path to spellfix extension for current platform
 */
export function getSpellfixPath(): string | null {
  const ext =
    process.platform === 'darwin' ? 'dylib' : process.platform === 'win32' ? 'dll' : 'so';
  const fileName = `spellfix.${ext}`;

  // In production: process.resourcesPath/extensions/spellfix.*
  // In development: resources/extensions/spellfix.*
  const paths = [
    join(process.resourcesPath || '', 'extensions', fileName),
    join(app.getAppPath(), 'resources', 'extensions', fileName),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Check if spellfix1 extension is available in the database
 */
export function isSpellfixAvailable(): boolean {
  try {
    const db = getDatabase();
    const result = db
      .prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='spellfix_words'"
      )
      .get() as { count: number };
    return result.count > 0;
  } catch {
    return false;
  }
}

/**
 * Mark database for deletion on next startup.
 * On Windows, SQLite WAL mode keeps files locked even after close(),
 * so we create a marker file and delete on next app launch when files are unlocked.
 */
export function deleteDatabaseFile(): void {
  const dbPath = getDatabasePath();
  const markerPath = `${dbPath}.delete`;

  // Try immediate deletion first (works on macOS/Linux)
  let immediateDeleteSucceeded = true;
  for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log('[Database] Deleted file:', filePath);
      }
    } catch {
      immediateDeleteSucceeded = false;
    }
  }

  // If immediate delete failed (Windows), create marker for deletion on next startup
  if (!immediateDeleteSucceeded) {
    console.log('[Database] Files still locked, marking for deletion on next startup');
    writeFileSync(markerPath, '');
  }
}
