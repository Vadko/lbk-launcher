import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { runMigrations } from './migrations';

/**
 * Database Manager - клас для управління локальною базою даних
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database.Database;

  private constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = join(userDataPath, 'littlebit.db');
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
      this.db.close();
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
  return join(userDataPath, 'littlebit.db');
}

/**
 * Delete database file completely (for full reset)
 */
export function deleteDatabaseFile(): void {
  const dbPath = getDatabasePath();
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  // Delete main DB file
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
    console.log('[Database] Deleted database file:', dbPath);
  }

  // Delete WAL file
  if (existsSync(walPath)) {
    unlinkSync(walPath);
    console.log('[Database] Deleted WAL file:', walPath);
  }

  // Delete SHM file
  if (existsSync(shmPath)) {
    unlinkSync(shmPath);
    console.log('[Database] Deleted SHM file:', shmPath);
  }
}
