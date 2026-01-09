import type Database from 'better-sqlite3';
import type {
  Game,
  GetGamesParams,
  GetGamesResult,
  Database as SupabaseDatabase,
} from '../../shared/types';
import { getDatabase } from './database';
import { getSearchVariations } from '../../shared/search-utils';

/**
 * Поля, які не зберігаються в локальній БД
 */
type ExcludedLocalFields =
  | 'archive_file_list'
  | 'voice_archive_file_list'
  | 'achievements_archive_file_list'
  | 'epic_archive_file_list';

/**
 * Параметри для вставки гри в БД (локальну SQLite)
 * Mapped type на основі Supabase Database типів, але з перетвореннями для SQLite:
 * - boolean -> number (0/1)
 * - arrays/objects -> JSON string
 * - Виключені поля file_list (окрім epic_archive_file_list)
 */
type GameInsertParams = {
  [K in keyof Omit<
    SupabaseDatabase['public']['Tables']['games']['Row'],
    ExcludedLocalFields
  >]: K extends 'approved' | 'is_adult' | 'license_only' | 'ai' | 'hide' | 'achievements_third_party'
  ? number // boolean перетворюється на 0/1 для SQLite
  : K extends 'platforms' | 'install_paths'
  ? string | null // JSON.stringify для SQLite
  : SupabaseDatabase['public']['Tables']['games']['Row'][K];
};

/**
 * Repository для роботи з іграми в локальній базі даних
 */
export class GamesRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Конвертувати row з SQLite в Game
   * Тільки для полів platforms та install_paths потрібен JSON.parse
   */
  private rowToGame(row: Record<string, unknown>): Game {
    const platforms =
      typeof row.platforms === 'string' ? JSON.parse(row.platforms) : row.platforms;
    const install_paths =
      typeof row.install_paths === 'string' && row.install_paths !== null
        ? JSON.parse(row.install_paths)
        : row.install_paths;

    return {
      ...row,
      approved: Boolean(row.approved),
      is_adult: Boolean(row.is_adult),
      license_only: Boolean(row.license_only),
      ai: Boolean(row.ai),
      hide: Boolean(row.hide),
      achievements_third_party: Boolean(row.achievements_third_party),
      platforms,
      install_paths,
    } as Game;
  }

  /**
   * Конвертувати Game в параметри для вставки в БД
   */
  private gameToInsertParams(game: Game): GameInsertParams {
    return {
      id: game.id,
      approved: game.approved ? 1 : 0,
      approved_at: game.approved_at ?? null,
      approved_by: game.approved_by ?? null,
      archive_hash: game.archive_hash ?? null,
      archive_path: game.archive_path ?? null,
      archive_size: game.archive_size ?? null,
      banner_path: game.banner_path ?? null,
      created_at: game.created_at ?? null,
      created_by: game.created_by ?? null,
      description: game.description ?? null,
      discord: game.discord ?? null,
      downloads: game.downloads ?? null,
      subscriptions: game.subscriptions ?? null,
      editing_progress: game.editing_progress ?? null,
      fonts_progress: game.fonts_progress ?? null,
      fundraising_current: game.fundraising_current ?? null,
      fundraising_goal: game.fundraising_goal ?? null,
      game_description: game.game_description ?? null,
      install_paths: game.install_paths ? JSON.stringify(game.install_paths) : null,
      installation_file_linux_path: game.installation_file_linux_path ?? null,
      installation_file_windows_path: game.installation_file_windows_path ?? null,
      is_adult: game.is_adult ? 1 : 0,
      license_only: game.license_only ? 1 : 0,
      logo_path: game.logo_path ?? null,
      name: game.name,
      platforms: JSON.stringify(game.platforms),
      project_id: game.project_id ?? null,
      slug: game.slug ?? null,
      status: game.status ?? null,
      support_url: game.support_url ?? null,
      team: game.team ?? null,
      telegram: game.telegram ?? null,
      textures_progress: game.textures_progress ?? null,
      thumbnail_path: game.thumbnail_path ?? null,
      translation_progress: game.translation_progress ?? null,
      twitter: game.twitter ?? null,
      updated_at: game.updated_at ?? null,
      version: game.version ?? null,
      video_url: game.video_url ?? null,
      voice_archive_hash: game.voice_archive_hash ?? null,
      voice_archive_path: game.voice_archive_path ?? null,
      voice_archive_size: game.voice_archive_size ?? null,
      voice_progress: game.voice_progress ?? null,
      achievements_archive_hash: game.achievements_archive_hash ?? null,
      achievements_archive_path: game.achievements_archive_path ?? null,
      achievements_archive_size: game.achievements_archive_size ?? null,
      achievements_third_party: game.achievements_third_party ? 1 : 0,
      additional_path: game.additional_path ?? null,
      epic_archive_hash: game.epic_archive_hash ?? null,
      epic_archive_path: game.epic_archive_path ?? null,
      epic_archive_size: game.epic_archive_size ?? null,
      steam_app_id: game.steam_app_id ?? null,
      website: game.website ?? null,
      youtube: game.youtube ?? null,
      ai: game.ai ? 1 : 0,
      hide: game.hide ? 1 : 0,
    };
  }

  /**
   * Отримати ігри з фільтрацією
   * Оскільки це local-first застосунок, повертаємо всі ігри одразу
   */
  getGames(params: GetGamesParams = {}): GetGamesResult {
    const { searchQuery = '', statuses = [], authors = [] } = params;
    // Note: showAdultGames is now handled in UI (blur effect) instead of filtering here

    const whereConditions: string[] = ['approved = 1', 'hide = 0'];
    const queryParams: (string | number)[] = [];

    // Filter by statuses (multi-select)
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(', ');
      whereConditions.push(`status IN (${placeholders})`);
      queryParams.push(...statuses);
    }

    // Adult games are always returned, UI will show blur overlay when setting is off

    const whereClause = whereConditions.join(' AND ');

    const gamesStmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereClause}
      ORDER BY name ASC
    `);

    const rows = gamesStmt.all(...queryParams) as Record<string, unknown>[];
    let games = rows.map((row) => this.rowToGame(row));

    // Filter by search query (case-insensitive in JS)
    if (searchQuery) {
      const variations = getSearchVariations(searchQuery);
      games = games.filter((game) => {
        const nameLower = game.name.toLowerCase();
        return variations.some((v) => nameLower.includes(v));
      });
    }

    // Filter by authors (multi-select) - post-process since team is comma-separated
    if (authors.length > 0) {
      games = games.filter((game) => {
        if (!game.team) return false;
        // Check if any of the selected authors is in the game's team field
        return authors.some((author) => game.team?.includes(author));
      });
    }

    const total = games.length;

    return { games, total };
  }

  /**
   * Отримати унікальних авторів
   * Парсить comma-separated team поле і повертає унікальних авторів
   */
  getUniqueAuthors(): string[] {
    const stmt = this.db.prepare(`
      SELECT team
      FROM games
      WHERE approved = 1 AND hide = 0 AND team IS NOT NULL AND team != ''
    `);

    const rows = stmt.all() as { team: string }[];

    // Parse comma-separated teams into individual authors
    const allAuthors = rows
      .flatMap((row) => {
        if (!row.team) return [];
        return row.team.split(',').map((author) => author.trim());
      })
      .filter((author) => author.length > 0);

    // Get unique authors and sort alphabetically
    const uniqueAuthors = [...new Set(allAuthors)].sort((a, b) =>
      a.localeCompare(b, 'uk')
    );

    return uniqueAuthors;
  }

  /**
   * Отримати ігри за ID
   */
  getGamesByIds(gameIds: string[]): Game[] {
    if (gameIds.length === 0) return [];

    const placeholders = gameIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE id IN (${placeholders})
        AND approved = 1
        AND hide = 0
      ORDER BY name ASC
    `);

    const rows = stmt.all(...gameIds) as Record<string, unknown>[];
    return rows.map((row) => this.rowToGame(row));
  }

  /**
   * Знайти ігри за install paths
   */
  findGamesByInstallPaths(installPaths: string[]): GetGamesResult {
    if (installPaths.length === 0) {
      return { games: [], total: 0 };
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE approved = 1
        AND hide = 0
        AND install_paths IS NOT NULL
    `);

    const rows = stmt.all() as Record<string, unknown>[];
    const allGames = rows.map((row) => this.rowToGame(row));

    // Нормалізуємо всі шляхи до простих назв папок
    const normalizedDetectedPaths = installPaths.map((path) => {
      const p = path.toLowerCase();
      // Витягуємо назву папки з шляху
      // "steamapps/common/GameName" -> "gamename"
      // "GameName" -> "gamename"
      if (p.includes('steamapps/common/')) {
        return p.split('steamapps/common/')[1];
      }
      if (p.includes('steamapps\\common\\')) {
        return p.split('steamapps\\common\\')[1];
      }
      if (p.includes('common/')) {
        return p.split('common/')[1];
      }
      if (p.includes('common\\')) {
        return p.split('common\\')[1];
      }
      return p;
    });

    const matchedGames = allGames.filter((game) => {
      if (!game.install_paths || !Array.isArray(game.install_paths)) return false;

      return game.install_paths.some((installPath) => {
        if (!installPath || !installPath.path) return false;

        // В БД тепер зберігаються тільки назви папок
        const dbPath = installPath.path.toLowerCase();

        // Просте порівняння
        return normalizedDetectedPaths.includes(dbPath);
      });
    });

    matchedGames.sort((a, b) => a.name.localeCompare(b.name, 'uk'));

    const total = matchedGames.length;

    return { games: matchedGames, total };
  }

  /**
   * Вставити або оновити гру (upsert)
   */
  upsertGame(game: Game): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO games (
        id, approved, approved_at, approved_by, archive_hash, archive_path, archive_size,
        banner_path, created_at, created_by, description, discord, downloads, subscriptions, editing_progress,
        fonts_progress, fundraising_current, fundraising_goal, game_description, install_paths,
        installation_file_linux_path, installation_file_windows_path, is_adult, license_only, logo_path,
        name, platforms, project_id, slug, status, support_url, team, telegram, textures_progress,
        thumbnail_path, translation_progress, twitter, updated_at, version, video_url,
        voice_archive_hash, voice_archive_path, voice_archive_size,
        voice_progress, achievements_archive_hash, achievements_archive_path, achievements_archive_size,
        epic_archive_hash, epic_archive_path, epic_archive_size,
        steam_app_id, website, youtube, ai, hide
      ) VALUES (
        @id, @approved, @approved_at, @approved_by, @archive_hash, @archive_path, @archive_size,
        @banner_path, @created_at, @created_by, @description, @discord, @downloads, @subscriptions, @editing_progress,
        @fonts_progress, @fundraising_current, @fundraising_goal, @game_description, @install_paths,
        @installation_file_linux_path, @installation_file_windows_path, @is_adult, @license_only, @logo_path,
        @name, @platforms, @project_id, @slug, @status, @support_url, @team, @telegram, @textures_progress,
        @thumbnail_path, @translation_progress, @twitter, @updated_at, @version, @video_url,
        @voice_archive_hash, @voice_archive_path, @voice_archive_size,
        @voice_progress, @achievements_archive_hash, @achievements_archive_path, @achievements_archive_size,
        @epic_archive_hash, @epic_archive_path, @epic_archive_size,
        @steam_app_id, @website, @youtube, @ai, @hide
      )
    `);

    stmt.run(this.gameToInsertParams(game));
  }

  /**
   * Вставити або оновити декілька ігор (batch upsert)
   */
  upsertGames(games: Game[]): void {
    const upsert = this.db.transaction((gamesToInsert: Game[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO games (
          id, approved, approved_at, approved_by, archive_hash, archive_path, archive_size,
          banner_path, created_at, created_by, description, discord, downloads, subscriptions, editing_progress,
          fonts_progress, fundraising_current, fundraising_goal, game_description, install_paths,
          installation_file_linux_path, installation_file_windows_path, is_adult, license_only, logo_path,
          name, platforms, project_id, slug, status, support_url, team, telegram, textures_progress,
          thumbnail_path, translation_progress, twitter, updated_at, version, video_url,
          voice_archive_hash, voice_archive_path, voice_archive_size,
          voice_progress, achievements_archive_hash, achievements_archive_path, achievements_archive_size,
          epic_archive_hash, epic_archive_path, epic_archive_size,
          steam_app_id, website, youtube, ai, hide
        ) VALUES (
          @id, @approved, @approved_at, @approved_by, @archive_hash, @archive_path, @archive_size,
          @banner_path, @created_at, @created_by, @description, @discord, @downloads, @subscriptions, @editing_progress,
          @fonts_progress, @fundraising_current, @fundraising_goal, @game_description, @install_paths,
          @installation_file_linux_path, @installation_file_windows_path, @is_adult, @license_only, @logo_path,
          @name, @platforms, @project_id, @slug, @status, @support_url, @team, @telegram, @textures_progress,
          @thumbnail_path, @translation_progress, @twitter, @updated_at, @version, @video_url,
          @voice_archive_hash, @voice_archive_path, @voice_archive_size,
          @voice_progress, @achievements_archive_hash, @achievements_archive_path, @achievements_archive_size,
          @epic_archive_hash, @epic_archive_path, @epic_archive_size,
          @steam_app_id, @website, @youtube, @ai, @hide
        )
      `);

      for (const game of gamesToInsert) {
        stmt.run(this.gameToInsertParams(game));
      }
    });

    upsert(games);
  }

  /**
   * Видалити гру
   */
  deleteGame(gameId: string): void {
    const stmt = this.db.prepare('DELETE FROM games WHERE id = ?');
    stmt.run(gameId);
  }

  /**
   * Отримати останній updated_at для синхронізації
   */
  getLastUpdatedAt(): string | null {
    const stmt = this.db.prepare(`
      SELECT MAX(updated_at) as max_updated_at
      FROM games
    `);

    const result = stmt.get() as { max_updated_at: string | null };
    return result.max_updated_at;
  }

  /**
   * Отримати гру за ID
   */
  getGameById(gameId: string): Game | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE id = ?
    `);

    const row = stmt.get(gameId) as Record<string, unknown> | undefined;
    return row ? this.rowToGame(row) : null;
  }
}
