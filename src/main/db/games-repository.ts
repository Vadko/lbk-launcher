import type Database from 'better-sqlite3';
import { getSearchVariations } from '../../shared/search-utils';
import type { Game, GetGamesParams, GetGamesResult } from '../../shared/types';
import { getDatabase } from './database';
import { upsertGamesTransaction, upsertGameSingle, deleteGameById } from './db-queries';

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
      ai: row.ai as string | null, // ai тепер текстове: 'edited' | 'non-edited' | null
      hide: Boolean(row.hide),
      achievements_third_party: row.achievements_third_party || null,
      platforms,
      install_paths,
    } as Game;
  }

  /**
   * Отримати ігри з фільтрацією
   * Оскільки це local-first застосунок, повертаємо всі ігри одразу
   */
  getGames(params: GetGamesParams = {}): GetGamesResult {
    const {
      searchQuery = '',
      statuses = [],
      authors = [],
      sortOrder = 'name',
      hideAiTranslations = false,
    } = params;

    const whereConditions: string[] = ['approved = 1', 'hide = 0'];
    const queryParams: (string | number)[] = [];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    // Filter by statuses (multi-select)
    if (statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(', ');
      whereConditions.push(`status IN (${placeholders})`);
      queryParams.push(...statuses);
    }

    // Filter by search query using FTS5
    if (searchQuery) {
      const variations = getSearchVariations(searchQuery);
      const ftsQuery = variations.map((v) => `"${v}"*`).join(' OR ');
      whereConditions.push(
        `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
      );
      queryParams.push(ftsQuery);
    }

    const whereClause = whereConditions.join(' AND ');
    // LTRIM видаляє цифри та символи з початку назви для сортування
    // Наприклад "112 Operator" сортується як "Operator", "[Chilla's Art]" як "Chilla's Art"
    const nameSortExpr = `LTRIM(name, '0123456789[]():!@#$%^&*-_.,"'' ') COLLATE NOCASE`;
    let orderClause: string;
    if (sortOrder === 'downloads') {
      orderClause = `downloads DESC NULLS LAST, ${nameSortExpr} ASC`;
    } else if (sortOrder === 'newest') {
      orderClause = `approved_at DESC NULLS LAST, ${nameSortExpr} ASC`;
    } else {
      orderClause = `${nameSortExpr} ASC`;
    }

    const gamesStmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereClause}
      ORDER BY ${orderClause}
    `);

    const rows = gamesStmt.all(...queryParams) as Record<string, unknown>[];
    let games = rows.map((row) => this.rowToGame(row));

    // Filter by authors (multi-select) - post-process since team is comma-separated
    if (authors.length > 0) {
      games = games.filter((game) => {
        if (!game.team) return false;
        return authors.some((author) => game.team?.includes(author));
      });
    }

    return { games, total: games.length };
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

    // Get unique authors and sort alphabetically (case-insensitive)
    const uniqueAuthors = [...new Set(allAuthors)].sort((a, b) =>
      a.localeCompare(b, 'uk', { sensitivity: 'base' })
    );

    return uniqueAuthors;
  }

  /**
   * Отримати ігри за ID
   */
  getGamesByIds(
    gameIds: string[],
    searchQuery?: string,
    hideAiTranslations = false,
    useSteamIdField = false
  ): Game[] {
    if (gameIds.length === 0) return [];

    const whereConditions = [
      `${useSteamIdField ? 'steam_app_id' : 'id'} IN (${gameIds.map(() => '?').join(',')})`,
      'approved = 1',
      'hide = 0',
    ];
    const queryParams: string[] = [...gameIds];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const variations = getSearchVariations(searchQuery);
      const ftsQuery = variations.map((v) => `"${v}"*`).join(' OR ');
      whereConditions.push(
        `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
      );
      queryParams.push(ftsQuery);
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY LTRIM(name, '0123456789[]():!@#$%^&*-_.,"'' ') COLLATE NOCASE ASC
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    return rows.map((row) => this.rowToGame(row));
  }

  /**
   * Знайти ігри за install paths
   */
  findGamesByInstallPaths(
    installPaths: string[],
    searchQuery?: string,
    hideAiTranslations = false
  ): GetGamesResult {
    if (installPaths.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = ['approved = 1', 'hide = 0', 'install_paths IS NOT NULL'];
    const queryParams: string[] = [];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const variations = getSearchVariations(searchQuery);
      const ftsQuery = variations.map((v) => `"${v}"*`).join(' OR ');
      whereConditions.push(
        `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
      );
      queryParams.push(ftsQuery);
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
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

    matchedGames.sort((a, b) =>
      a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' })
    );

    // Count unique games by slug (not total translations)
    const uniqueCount = new Set(matchedGames.map((g) => g.slug || g.id)).size;

    return { games: matchedGames, total: matchedGames.length, uniqueCount };
  }

  /**
   * Знайти ігри за Steam App IDs
   * Повертає всі переклади, але total рахує унікальні ігри (за steam_app_id)
   */
  findGamesBySteamAppIds(
    steamAppIds: number[],
    searchQuery?: string,
    hideAiTranslations = false
  ): GetGamesResult {
    if (steamAppIds.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = [
      'approved = 1',
      'hide = 0',
      'steam_app_id IS NOT NULL',
      `steam_app_id IN (${steamAppIds.map(() => '?').join(',')})`,
    ];
    const queryParams: (string | number)[] = [...steamAppIds];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const variations = getSearchVariations(searchQuery);
      const ftsQuery = variations.map((v) => `"${v}"*`).join(' OR ');
      whereConditions.push(
        `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
      );
      queryParams.push(ftsQuery);
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY LTRIM(name, '0123456789[]():!@#$%^&*-_.,"'' ') COLLATE NOCASE ASC
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    const games = rows.map((row) => this.rowToGame(row));

    return { games, total: games.length };
  }

  /**
   * Підрахувати кількість унікальних ігор доступних зі Steam бібліотеки
   * (рахує унікальні steam_app_id, щоб не дублювати ігри з кількома перекладами)
   */
  countGamesBySteamAppIds(steamAppIds: number[]): number {
    if (steamAppIds.length === 0) {
      return 0;
    }

    const stmt = this.db.prepare(`
      SELECT COUNT(DISTINCT steam_app_id) as count
      FROM games
      WHERE approved = 1
        AND hide = 0
        AND steam_app_id IS NOT NULL
        AND steam_app_id IN (${steamAppIds.map(() => '?').join(',')})
    `);

    const result = stmt.get(...steamAppIds) as { count: number };
    return result.count;
  }

  /**
   * Вставити або оновити гру (upsert)
   */
  upsertGame(game: Game): void {
    upsertGameSingle(this.db, game);
  }

  /**
   * Вставити або оновити декілька ігор (batch upsert)
   */
  upsertGames(games: Game[]): void {
    upsertGamesTransaction(this.db, games);
  }

  /**
   * Видалити гру
   */
  deleteGame(gameId: string): void {
    deleteGameById(this.db, gameId);
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

  /**
   * Отримати лічильники для фільтрів (ефективний SQL запит з агрегацією)
   * Рахує унікальні ігри за slug (або id якщо slug відсутній),
   * щоб не дублювати ігри з кількома перекладами
   */
  getFilterCounts(): {
    planned: number;
    'in-progress': number;
    completed: number;
    'with-achievements': number;
    'with-voice': number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN status = 'planned' THEN COALESCE(slug, id) END) as planned,
        COUNT(DISTINCT CASE WHEN status = 'in-progress' THEN COALESCE(slug, id) END) as in_progress,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN COALESCE(slug, id) END) as completed,
        COUNT(DISTINCT CASE WHEN achievements_archive_path IS NOT NULL AND achievements_archive_path != '' THEN COALESCE(slug, id) END) as with_achievements,
        COUNT(DISTINCT CASE WHEN voice_archive_path IS NOT NULL AND voice_archive_path != '' THEN COALESCE(slug, id) END) as with_voice
      FROM games
      WHERE approved = 1 AND hide = 0
    `);

    const row = stmt.get() as {
      planned: number;
      in_progress: number;
      completed: number;
      with_achievements: number;
      with_voice: number;
    };

    return {
      planned: row.planned || 0,
      'in-progress': row.in_progress || 0,
      completed: row.completed || 0,
      'with-achievements': row.with_achievements || 0,
      'with-voice': row.with_voice || 0,
    };
  }
}
