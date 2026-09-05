import { existsSync, type FSWatcher, readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { buildFtsQuery, stripApostrophes } from '../../shared/search-utils';
import type {
  ContentTypeFilterType,
  FacetedFilterCounts,
  FacetedFilterCountsRequest,
  FacetOptionCount,
  Game,
  GetGamesParams,
  GetGamesResult,
  SortOrderType,
  SpecialFilterType,
  TagOption,
} from '../../shared/types';
import { normalizeInstalledFolder } from '../utils/install-path';
import type { WorkshopTarget } from '../utils/steam-workshop';
import { getDatabase, isSpellfixAvailable } from './database';
import {
  deleteGameById,
  parseTagIds,
  upsertGameSingle,
  upsertGamesTransaction,
  VISIBLE_GAMES_SQL,
} from './db-queries';

type SqlFragment = { clause: string; params: (string | number)[] } | null;

function escapeLikeValue(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Repository для роботи з іграми в локальній базі даних
 */
export class GamesRepository {
  private static instance: GamesRepository | null = null;
  private db: Database.Database;
  private testGamesPath: string;
  private fileWatcher: FSWatcher | null = null;
  private fileWatchDebounceTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.db = getDatabase();
    this.testGamesPath = join(__dirname, '../../test/games.json');
    this.loadTestGamesInDevelopment();
    this.watchTestGamesFile();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GamesRepository {
    if (!GamesRepository.instance) {
      GamesRepository.instance = new GamesRepository();
    }
    return GamesRepository.instance;
  }

  /**
   * Прочитати і розпарсити test/games.json
   */
  private readTestGamesFile(): Game[] {
    if (!existsSync(this.testGamesPath)) {
      return [];
    }

    try {
      const fileContent = readFileSync(this.testGamesPath, 'utf-8');
      const games = JSON.parse(fileContent);
      return Array.isArray(games) ? games : [];
    } catch (error) {
      console.error('[DEV] Error reading test/games.json:', error);
      return [];
    }
  }

  /**
   * Відстежувати зміни в test/games.json
   */
  private watchTestGamesFile(): void {
    if (process.env.NODE_ENV !== 'development' || !existsSync(this.testGamesPath)) {
      return;
    }

    try {
      this.fileWatcher = watch(this.testGamesPath, (eventType) => {
        if (eventType === 'change') {
          if (this.fileWatchDebounceTimer) {
            clearTimeout(this.fileWatchDebounceTimer);
          }

          this.fileWatchDebounceTimer = setTimeout(() => {
            console.log('[DEV] Test games file changed, reloading...');
            this.loadTestGamesInDevelopment();
            this.fileWatchDebounceTimer = null;
          }, 2000);
        }
      });

      process.on('exit', this.cleanup.bind(this));
    } catch (error) {
      console.error('[DEV] Failed to setup file watcher:', error);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.fileWatchDebounceTimer) {
      clearTimeout(this.fileWatchDebounceTimer);
      this.fileWatchDebounceTimer = null;
    }
  }

  /**
   * Повідомити renderer процес про зміни в іграх
   */
  private notifyGamesChanged(): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send('test-games-changed');
    });
  }

  /**
   * Завантажити тестові ігри з test/games.json в режимі розробки
   */
  private loadTestGamesInDevelopment(): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    try {
      const testGames = this.readTestGamesFile();

      if (testGames.length > 0) {
        // Delete all test games (any id starting with 'test-')
        this.db.prepare(`DELETE FROM games WHERE id LIKE 'test-%'`).run();

        // Modify test games to appear at top of list
        const modifiedTestGames = testGames.map((game, index) => ({
          ...game,
          name: `${game.name} (TEST)`,
          id: `test-${game.id}`,
          slug: `test-${game.slug || game.id}`,
          approved_at: new Date(2099, 11, 31, 23, 59, 59 - index).toISOString(),
        })) as Game[];

        this.upsertGames(modifiedTestGames);

        this.notifyGamesChanged();

        console.log(`[DEV] Loaded ${modifiedTestGames.length} test game(s)`);
      }
    } catch (error) {
      console.error('[DEV] Error loading test games:', error);
    }
  }

  /**
   * Побудувати ORDER BY clause для сортування ігор
   */
  private buildOrderClause(sortOrder: SortOrderType): string {
    // LTRIM видаляє цифри та символи з початку назви для сортування
    // Наприклад "112 Operator" сортується як "Operator", "[Chilla's Art]" як "Chilla's Art"
    const nameSortExpr = `LTRIM(name, '0123456789[]():!@#$%^&*-_.,"'' ') COLLATE NOCASE`;

    if (sortOrder === 'downloads') {
      return `downloads DESC NULLS LAST, ${nameSortExpr} ASC`;
    }
    if (sortOrder === 'subscribers') {
      return `subscriptions DESC NULLS LAST, ${nameSortExpr} ASC`;
    }
    if (sortOrder === 'newest') {
      return `created_at DESC NULLS LAST, ${nameSortExpr} ASC`;
    }
    if (sortOrder === 'updated') {
      return `approved_at DESC NULLS LAST, ${nameSortExpr} ASC`;
    }
    return `${nameSortExpr} ASC`;
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
    const screenshots =
      typeof row.screenshots === 'string' && row.screenshots !== null
        ? (JSON.parse(row.screenshots) as string[])
        : ((row.screenshots as string[] | null) ?? null);
    const steam_tag_ids = parseTagIds(row.steam_tag_ids);

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
      screenshots,
      steam_tag_ids,
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
      tagIds = [],
      sortOrder = 'name',
      hideAiTranslations = false,
    } = params;

    const whereConditions: string[] = [VISIBLE_GAMES_SQL];
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

    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(', ');
      whereConditions.push(
        `EXISTS (SELECT 1 FROM json_each(games.steam_tag_ids) WHERE json_each.value IN (${placeholders}))`
      );
      queryParams.push(...tagIds);
    }

    // Filter by search query using FTS5 (min 2 chars to avoid expensive single-char prefix scans)
    if (searchQuery && searchQuery.trim().length >= 2) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      } else {
        // No usable tokens (e.g. only punctuation/single-char) — fall back to LIKE
        whereConditions.push('name LIKE ?');
        queryParams.push(`%${searchQuery.trim()}%`);
      }
    } else if (searchQuery) {
      // For 1-char queries use simple LIKE (faster than FTS prefix scan)
      whereConditions.push('name LIKE ?');
      queryParams.push(`${searchQuery.trim()}%`);
    }

    const whereClause = whereConditions.join(' AND ');
    const orderClause = this.buildOrderClause(sortOrder);

    const gamesStmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereClause}
      ORDER BY ${orderClause}
    `);

    const rows = gamesStmt.all(...queryParams) as Record<string, unknown>[];
    let games = rows.map((row) => this.rowToGame(row));

    // Spellfix1 fuzzy fallback when FTS returns 0 results
    if (searchQuery && games.length === 0 && isSpellfixAvailable()) {
      games = this.fuzzySearchFallback(
        searchQuery,
        whereConditions,
        queryParams,
        orderClause
      );
    }

    // Filter by authors (multi-select) - post-process since team is comma-separated
    if (authors.length > 0) {
      games = games.filter((game) => {
        if (!game.team) {
          return false;
        }
        return authors.some((author) => game.team?.includes(author));
      });
    }

    return { games, total: games.length };
  }

  /**
   * Spellfix1 fuzzy fallback: correct each query word via spellfix_words,
   * then re-run FTS5 with corrected words
   */
  private fuzzySearchFallback(
    searchQuery: string,
    _baseConditions: string[],
    _baseParams: (string | number)[],
    orderClause: string
  ): Game[] {
    try {
      // словник spellfix — без апострофів (extractUniqueWords), запит теж стріпаємо
      const queryWords = stripApostrophes(searchQuery)
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      if (queryWords.length === 0) {
        return [];
      }

      const correctedWords: string[] = [];
      const spellfixStmt = this.db.prepare(
        'SELECT word FROM spellfix_words WHERE word MATCH ? AND top=5 ORDER BY score LIMIT 1'
      );

      for (const word of queryWords) {
        const result = spellfixStmt.get(word) as { word: string } | undefined;
        correctedWords.push(result ? result.word : word);
      }

      // Build FTS query from corrected words
      const correctedFts = correctedWords.map((w) => `"${w}"*`).join(' OR ');

      const fuzzyStmt = this.db.prepare(`
        SELECT * FROM games
        WHERE ${VISIBLE_GAMES_SQL}
          AND id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)
        ORDER BY ${orderClause}
      `);

      const fuzzyRows = fuzzyStmt.all(correctedFts) as Record<string, unknown>[];
      return fuzzyRows.map((row) => this.rowToGame(row));
    } catch (e) {
      console.warn('[GamesRepository] Spellfix fuzzy fallback error:', e);
      return [];
    }
  }

  /**
   * Отримати унікальних авторів
   * Парсить comma-separated team поле і повертає унікальних авторів
   */
  getUniqueAuthors(): string[] {
    const stmt = this.db.prepare(`
      SELECT team
      FROM games
      WHERE ${VISIBLE_GAMES_SQL} AND team IS NOT NULL AND team != ''
    `);

    const rows = stmt.all() as { team: string }[];

    // Parse comma-separated teams into individual authors
    const allAuthors = rows
      .flatMap((row) => {
        if (!row.team) {
          return [];
        }
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
    useSteamIdField = false,
    sortOrder: SortOrderType = 'name'
  ): Game[] {
    if (gameIds.length === 0) {
      return [];
    }

    const whereConditions = [
      `${useSteamIdField ? 'steam_app_id' : 'id'} IN (${gameIds.map(() => '?').join(',')})`,
      VISIBLE_GAMES_SQL,
    ];
    const queryParams: string[] = [...gameIds];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      }
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${this.buildOrderClause(sortOrder)}
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    return rows.map((row) => this.rowToGame(row));
  }

  /**
   * Find games installed on the system by folder name, unioned with installed
   * Steam app ids (kept consistent with the getDetectedGames badge).
   */
  findGamesByInstallPaths(
    installPaths: string[],
    searchQuery?: string,
    hideAiTranslations = false,
    sortOrder: SortOrderType = 'name',
    steamAppIds: number[] = []
  ): GetGamesResult {
    if (installPaths.length === 0 && steamAppIds.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = [
      VISIBLE_GAMES_SQL,
      // Keep app-id-only rows (install_paths NULL) so the steamAppIds union below
      // can match them, staying consistent with the app-id-authoritative badge.
      '(install_paths IS NOT NULL OR steam_app_id IS NOT NULL)',
    ];
    const queryParams: string[] = [];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      }
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${this.buildOrderClause(sortOrder)}
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    const allGames = rows.map((row) => this.rowToGame(row));

    // Normalize both sides with the shared helper so the DB folder name and the
    // detected system path reduce to the same key (kept in sync with the badge).
    const normalizedDetectedPaths = new Set(installPaths.map(normalizeInstalledFolder));
    const appIdSet = new Set(steamAppIds);

    const matchedGames = allGames.filter((game) => {
      // Authoritative: installed Steam app id (immune to installdir/folder drift,
      // keeps this in sync with the sidebar's getDetectedGames badge).
      if (game.steam_app_id != null && appIdSet.has(game.steam_app_id)) {
        return true;
      }

      if (!game.install_paths || !Array.isArray(game.install_paths)) {
        return false;
      }

      return game.install_paths.some(
        (installPath) =>
          installPath?.path &&
          normalizedDetectedPaths.has(normalizeInstalledFolder(installPath.path))
      );
    });

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
    hideAiTranslations = false,
    sortOrder: SortOrderType = 'name'
  ): GetGamesResult {
    if (steamAppIds.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = [
      VISIBLE_GAMES_SQL,
      'steam_app_id IS NOT NULL',
      `steam_app_id IN (${steamAppIds.map(() => '?').join(',')})`,
    ];
    const queryParams: (string | number)[] = [...steamAppIds];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      }
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${this.buildOrderClause(sortOrder)}
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
      WHERE ${VISIBLE_GAMES_SQL}
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
   * Інкрементувати лічильник завантажень для гри в локальній БД
   */
  incrementDownloads(gameId: string): void {
    const stmt = this.db.prepare(
      'UPDATE games SET downloads = COALESCE(downloads, 0) + 1 WHERE id = ?'
    );
    stmt.run(gameId);
  }

  /**
   * Розблокувати/заблокувати приховану гру локально для користувача.
   * Записує в `user_unlocked` - локальну колонку, яка НЕ синхронізується з Supabase
   * і тому не злітає при наступному оновленні бази (на відміну від прямого
   * редагування `hide`, яке завжди перезаписується значенням з сервера).
   * В WHERE-умовах запитів приховані ігри показуються, якщо `user_unlocked = 1`.
   */
  setGameVisibility(gameId: string, hidden: boolean): boolean {
    const stmt = this.db.prepare('UPDATE games SET user_unlocked = ? WHERE id = ?');
    const result = stmt.run(hidden ? 0 : 1, gameId);
    return result.changes > 0;
  }

  getWorkshopTargets(): WorkshopTarget[] {
    return this.db
      .prepare(
        `SELECT id, steam_app_id, workshop_id FROM games
         WHERE kind = 'workshop' AND workshop_id IS NOT NULL AND steam_app_id IS NOT NULL`
      )
      .all() as WorkshopTarget[];
  }

  /**
   * Steam App ID усіх ігор каталогу, для яких є переклад — незалежно від
   * способу встановлення (Workshop чи архів). На відміну від
   * `getWorkshopTargets`, який бере лише `kind = 'workshop'` (це рідкість —
   * абсолютна більшість перекладів встановлюються архівом).
   */
  getTranslatedSteamAppIds(): number[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT steam_app_id FROM games
         WHERE ${VISIBLE_GAMES_SQL} AND steam_app_id IS NOT NULL`
      )
      .all() as { steam_app_id: number }[];
    return rows.map((row) => row.steam_app_id);
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
   * Теги для фільтра: лише ті, що є у видимих іграх, з локалізованими назвами.
   * JOIN зі словником водночас відсіює id, для яких назви ще не синкнулись.
   */
  getTagOptions(): TagOption[] {
    return this.db
      .prepare(
        `SELECT t.tagid AS tagid, t.name AS name, COUNT(DISTINCT COALESCE(g.slug, g.id)) AS count
         FROM games g
         JOIN json_each(g.steam_tag_ids) je
         JOIN steam_tag_names t ON t.tagid = je.value
         WHERE ${VISIBLE_GAMES_SQL}
         GROUP BY t.tagid, t.name
         ORDER BY count DESC, t.name`
      )
      .all() as TagOption[];
  }

  private static readonly STATUS_VALUES = [
    'planned',
    'in-progress',
    'completed',
    'tech-improvement',
  ] as const;

  private static readonly CONTENT_TYPES: ContentTypeFilterType[] = [
    'with-achievements',
    'with-voice',
    'from-workshop',
  ];

  private static readonly CONTENT_TYPE_PREDICATES: Record<ContentTypeFilterType, string> =
    {
      'with-achievements': `(achievements_archive_path IS NOT NULL AND achievements_archive_path != '')`,
      'with-voice': `((voice_archive_path IS NOT NULL AND voice_archive_path != '') OR voice_progress IS NOT NULL)`,
      'from-workshop': `(kind = 'workshop')`,
    };

  private buildFacetSearchFragment(searchQuery?: string): SqlFragment {
    if (!searchQuery) {
      return null;
    }
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        return {
          clause: 'id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)',
          params: [ftsQuery],
        };
      }
      return { clause: 'name LIKE ?', params: [`%${trimmed}%`] };
    }
    if (trimmed.length === 1) {
      return { clause: 'name LIKE ?', params: [`${trimmed}%`] };
    }
    return null;
  }

  private buildFacetStatusFragment(statuses: string[]): SqlFragment {
    if (statuses.length === 0) {
      return null;
    }
    return {
      clause: `status IN (${statuses.map(() => '?').join(', ')})`,
      params: statuses,
    };
  }

  private buildFacetTagsFragment(tagIds: number[]): SqlFragment {
    if (tagIds.length === 0) {
      return null;
    }
    return {
      clause: `EXISTS (SELECT 1 FROM json_each(games.steam_tag_ids) WHERE json_each.value IN (${tagIds
        .map(() => '?')
        .join(', ')}))`,
      params: tagIds,
    };
  }

  private buildFacetAuthorsFragment(authors: string[]): SqlFragment {
    if (authors.length === 0) {
      return null;
    }
    return {
      clause: `(${authors.map(() => `team LIKE ? ESCAPE '\\'`).join(' OR ')})`,
      params: authors.map((author) => `%${escapeLikeValue(author)}%`),
    };
  }

  private buildFacetContentTypeFragment(types: ContentTypeFilterType[]): SqlFragment {
    if (types.length === 0) {
      return null;
    }
    return {
      clause: types
        .map((type) => GamesRepository.CONTENT_TYPE_PREDICATES[type])
        .join(' AND '),
      params: [],
    };
  }

  private mergeFacetFragments(
    conditions: string[],
    params: (string | number)[],
    fragments: SqlFragment[]
  ): { conditions: string[]; params: (string | number)[] } {
    const outConditions = [...conditions];
    const outParams = [...params];
    for (const fragment of fragments) {
      if (fragment) {
        outConditions.push(fragment.clause);
        outParams.push(...fragment.params);
      }
    }
    return { conditions: outConditions, params: outParams };
  }

  private getStatusFacetCounts(
    baseConditions: string[],
    baseParams: (string | number)[],
    currentStatuses: string[],
    otherFragments: SqlFragment[]
  ): Record<string, FacetOptionCount> {
    const { conditions, params } = this.mergeFacetFragments(
      baseConditions,
      baseParams,
      otherFragments
    );

    const selectSql: string[] = [];
    const selectParams: (string | number)[] = [];

    for (const status of GamesRepository.STATUS_VALUES) {
      const alias = status.replace(/-/g, '_');
      selectSql.push(
        `COUNT(DISTINCT CASE WHEN status = ? THEN COALESCE(slug, id) END) AS total_${alias}`
      );
      selectParams.push(status);

      if (currentStatuses.length > 0) {
        selectSql.push(
          `COUNT(DISTINCT CASE WHEN status = ? AND status NOT IN (${currentStatuses
            .map(() => '?')
            .join(', ')}) THEN COALESCE(slug, id) END) AS added_${alias}`
        );
        selectParams.push(status, ...currentStatuses);
      } else {
        selectSql.push(
          `COUNT(DISTINCT CASE WHEN status = ? THEN COALESCE(slug, id) END) AS added_${alias}`
        );
        selectParams.push(status);
      }
    }

    const stmt = this.db.prepare(`
      SELECT ${selectSql.join(', ')}
      FROM games
      WHERE ${conditions.join(' AND ')}
    `);

    const row = stmt.get(...selectParams, ...params) as Record<string, number>;

    const result: Record<string, FacetOptionCount> = {};
    for (const status of GamesRepository.STATUS_VALUES) {
      const alias = status.replace(/-/g, '_');
      result[status] = {
        total: row[`total_${alias}`] || 0,
        added: row[`added_${alias}`] || 0,
      };
    }
    return result;
  }

  private getTagsFacetCounts(
    baseConditions: string[],
    baseParams: (string | number)[],
    currentTagIds: number[],
    otherFragments: SqlFragment[]
  ): Record<number, FacetOptionCount> {
    const { conditions, params } = this.mergeFacetFragments(
      baseConditions,
      baseParams,
      otherFragments
    );

    const addedExpr =
      currentTagIds.length > 0
        ? `COUNT(DISTINCT CASE WHEN NOT EXISTS (
             SELECT 1 FROM json_each(games.steam_tag_ids) je2
             WHERE je2.value IN (${currentTagIds.map(() => '?').join(', ')})
           ) THEN COALESCE(games.slug, games.id) END) AS added`
        : `COUNT(DISTINCT COALESCE(games.slug, games.id)) AS added`;

    const stmt = this.db.prepare(`
      SELECT t.tagid AS tagid,
        COUNT(DISTINCT COALESCE(games.slug, games.id)) AS total,
        ${addedExpr}
      FROM games
      JOIN json_each(games.steam_tag_ids) je ON 1=1
      JOIN steam_tag_names t ON t.tagid = je.value
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.tagid
    `);

    const allParams =
      currentTagIds.length > 0 ? [...currentTagIds, ...params] : [...params];
    const rows = stmt.all(...allParams) as {
      tagid: number;
      total: number;
      added: number;
    }[];

    const result: Record<number, FacetOptionCount> = {};
    for (const row of rows) {
      result[row.tagid] = { total: row.total || 0, added: row.added || 0 };
    }
    return result;
  }

  /**
   * Автори - вільний comma-separated текст без окремої таблиці, тому лічильники
   * рахуються так само, як фільтрація по авторах у getGames()/useGames.ts:
   * підрядковий збіг у JS, а не SQL JOIN.
   */
  private getAuthorsFacetCounts(
    baseConditions: string[],
    baseParams: (string | number)[],
    currentAuthors: string[],
    knownAuthors: string[],
    otherFragments: SqlFragment[]
  ): Record<string, FacetOptionCount> {
    const { conditions, params } = this.mergeFacetFragments(
      baseConditions,
      baseParams,
      otherFragments
    );

    const stmt = this.db.prepare(`
      SELECT COALESCE(slug, id) AS key, team
      FROM games
      WHERE ${conditions.join(' AND ')} AND team IS NOT NULL AND team != ''
    `);

    const rows = stmt.all(...params) as { key: string; team: string }[];

    const totals = new Map<string, Set<string>>();
    const addeds = new Map<string, Set<string>>();
    for (const author of knownAuthors) {
      totals.set(author, new Set());
      addeds.set(author, new Set());
    }

    for (const row of rows) {
      const alreadyMatchesCurrent =
        currentAuthors.length > 0 &&
        currentAuthors.some((author) => row.team.includes(author));

      for (const author of knownAuthors) {
        if (!row.team.includes(author)) {
          continue;
        }
        totals.get(author)?.add(row.key);
        if (!alreadyMatchesCurrent) {
          addeds.get(author)?.add(row.key);
        }
      }
    }

    const result: Record<string, FacetOptionCount> = {};
    for (const author of knownAuthors) {
      result[author] = {
        total: totals.get(author)?.size ?? 0,
        added: addeds.get(author)?.size ?? 0,
      };
    }
    return result;
  }

  private getContentTypeFacetCounts(
    baseConditions: string[],
    baseParams: (string | number)[],
    currentTypes: ContentTypeFilterType[],
    otherFragments: SqlFragment[]
  ): Record<ContentTypeFilterType, number> {
    const { conditions, params } = this.mergeFacetFragments(
      baseConditions,
      baseParams,
      otherFragments
    );

    const selectSql = GamesRepository.CONTENT_TYPES.map((type) => {
      const otherSelected = currentTypes.filter((t) => t !== type);
      const predicate = [
        GamesRepository.CONTENT_TYPE_PREDICATES[type],
        ...otherSelected.map((t) => GamesRepository.CONTENT_TYPE_PREDICATES[t]),
      ].join(' AND ');
      const alias = type.replace(/-/g, '_');
      return `COUNT(DISTINCT CASE WHEN ${predicate} THEN COALESCE(slug, id) END) AS ${alias}`;
    });

    const stmt = this.db.prepare(`
      SELECT ${selectSql.join(', ')}
      FROM games
      WHERE ${conditions.join(' AND ')}
    `);

    const row = stmt.get(...params) as Record<string, number>;

    const result = {} as Record<ContentTypeFilterType, number>;
    for (const type of GamesRepository.CONTENT_TYPES) {
      result[type] = row[type.replace(/-/g, '_')] || 0;
    }
    return result;
  }

  private getSpecialFacetCounts(
    coreConditions: string[],
    coreParams: (string | number)[],
    membershipIds: Record<SpecialFilterType, string[]>,
    otherFragments: SqlFragment[]
  ): Record<SpecialFilterType, number> {
    const { conditions, params } = this.mergeFacetFragments(
      coreConditions,
      coreParams,
      otherFragments
    );

    const options = Object.keys(membershipIds) as SpecialFilterType[];
    const selectSql: string[] = [];
    const selectParams: (string | number)[] = [];

    for (const option of options) {
      const ids = membershipIds[option];
      const alias = option.replace(/-/g, '_');
      if (ids.length === 0) {
        selectSql.push(`0 AS ${alias}`);
        continue;
      }
      selectSql.push(
        `COUNT(DISTINCT CASE WHEN id IN (${ids
          .map(() => '?')
          .join(', ')}) THEN COALESCE(slug, id) END) AS ${alias}`
      );
      selectParams.push(...ids);
    }

    const stmt = this.db.prepare(`
      SELECT ${selectSql.join(', ')}
      FROM games
      WHERE ${conditions.join(' AND ')}
    `);

    const row = stmt.get(...selectParams, ...params) as Record<string, number>;

    const result = {} as Record<SpecialFilterType, number>;
    for (const option of options) {
      result[option] = row[option.replace(/-/g, '_')] || 0;
    }
    return result;
  }

  /**
   * Faceted (e-commerce style) лічильники для модалки фільтрів: кожна опція
   * рахується з урахуванням усіх ІНШИХ активних фільтрів (пошук, статуси,
   * автори, теги, типи контенту, бібліотечний фільтр), а не глобально.
   * Статуси/автори/теги - OR-групи (значення "додаються" одне до одного) -
   * повертають total/added (added = скільки ігор додасться до списку, якщо
   * опцію теж вибрати). Типи контенту (AND-група) та бібліотечний фільтр
   * (single-select) - звужуючі, повертають лише total.
   */
  getFacetedFilterCounts(request: FacetedFilterCountsRequest): FacetedFilterCounts {
    const {
      searchQuery,
      statuses = [],
      authors = [],
      tagIds = [],
      contentTypes = [],
      specialFilter = null,
      hideAiTranslations = false,
      knownAuthors = [],
      favoriteGameIds = [],
      installedTranslationGameIds = [],
      installedGamePaths = [],
      steamLibraryAppIds = [],
      gogTitles = [],
      epicTitles = [],
      xboxFolderNames = [],
    } = request;

    // Мембершип бібліотечних фільтрів - повне перевикористання існуючих
    // finder-методів без інших фільтрів (сирий склад кожної опції).
    const membershipIds: Record<SpecialFilterType, string[]> = {
      'favorite-translations': favoriteGameIds,
      'installed-translations': installedTranslationGameIds,
      'installed-games': this.findGamesByInstallPaths(installedGamePaths).games.map(
        (g) => g.id
      ),
      'available-in-steam': this.findGamesBySteamAppIds(steamLibraryAppIds).games.map(
        (g) => g.id
      ),
      'owned-gog-games': this.findGamesByTitles(gogTitles).games.map((g) => g.id),
      'owned-epic-games': this.findGamesByTitles(epicTitles).games.map((g) => g.id),
      'installed-xbox-games': this.findGamesByXboxPaths(xboxFolderNames).games.map(
        (g) => g.id
      ),
    };

    const search = this.buildFacetSearchFragment(searchQuery);
    const coreConditions: string[] = [VISIBLE_GAMES_SQL];
    const coreParams: (string | number)[] = [];
    if (hideAiTranslations) {
      coreConditions.push('ai IS NULL');
    }
    if (search) {
      coreConditions.push(search.clause);
      coreParams.push(...search.params);
    }

    // baseConditions/-Params: core + currently active library filter (if any) -
    // used by every category EXCEPT the library filter itself, since that one
    // must evaluate each candidate option standing in for the active one, not
    // stacked on top of it.
    const specialMembership = specialFilter ? membershipIds[specialFilter] : null;
    const baseConditions = [...coreConditions];
    const baseParams = [...coreParams];
    if (specialMembership) {
      if (specialMembership.length === 0) {
        baseConditions.push('0');
      } else {
        baseConditions.push(`id IN (${specialMembership.map(() => '?').join(', ')})`);
        baseParams.push(...specialMembership);
      }
    }

    const statusFrag = this.buildFacetStatusFragment(statuses);
    const tagsFrag = this.buildFacetTagsFragment(tagIds);
    const authorsFrag = this.buildFacetAuthorsFragment(authors);
    const contentTypeFrag = this.buildFacetContentTypeFragment(contentTypes);

    return {
      statuses: this.getStatusFacetCounts(baseConditions, baseParams, statuses, [
        tagsFrag,
        authorsFrag,
        contentTypeFrag,
      ]),
      tags: this.getTagsFacetCounts(baseConditions, baseParams, tagIds, [
        statusFrag,
        authorsFrag,
        contentTypeFrag,
      ]),
      authors: this.getAuthorsFacetCounts(
        baseConditions,
        baseParams,
        authors,
        knownAuthors,
        [statusFrag, tagsFrag, contentTypeFrag]
      ),
      contentTypes: this.getContentTypeFacetCounts(
        baseConditions,
        baseParams,
        contentTypes,
        [statusFrag, authorsFrag, tagsFrag]
      ),
      specialFilters: this.getSpecialFacetCounts(
        coreConditions,
        coreParams,
        membershipIds,
        [statusFrag, authorsFrag, tagsFrag, contentTypeFrag]
      ),
    };
  }

  /**
   * Знайти ігри за списком назв папок Xbox-інсталяцій. Метчимо проти
   * `install_paths` JSON-поля (елементи `{type: 'xbox', path: 'FolderName'}`).
   * SQLite не вміє JSON-аррей-індекси, тож використовуємо json_each для
   * розгортання install_paths і LIKE-патерн для пошуку відповідного запису.
   */
  findGamesByXboxPaths(
    folderNames: string[],
    searchQuery?: string,
    hideAiTranslations = false,
    sortOrder: SortOrderType = 'name'
  ): GetGamesResult {
    const trimmed = folderNames.map((f) => f.trim()).filter((f) => f.length > 0);
    if (trimmed.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = [VISIBLE_GAMES_SQL];
    const placeholders = trimmed.map(() => '?').join(',');
    // Кожен елемент install_paths — JSON {type, path}. Шукаємо такі де
    // type='xbox' і path COLLATE NOCASE IN (folderNames).
    whereConditions.push(`
      EXISTS (
        SELECT 1
        FROM json_each(games.install_paths)
        WHERE json_extract(json_each.value, '$.type') = 'xbox'
          AND json_extract(json_each.value, '$.path') COLLATE NOCASE IN (${placeholders})
      )
    `);

    const queryParams: (string | number)[] = [...trimmed];

    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      }
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${this.buildOrderClause(sortOrder)}
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    const games = rows.map((row) => this.rowToGame(row));
    return { games, total: games.length };
  }

  /**
   * Знайти ігри за списком назв (exact match, case-insensitive)
   */
  findGamesByTitles(
    titles: string[],
    searchQuery?: string,
    hideAiTranslations = false,
    sortOrder: SortOrderType = 'name'
  ): GetGamesResult {
    if (titles.length === 0) {
      return { games: [], total: 0 };
    }

    // Trim all titles to remove extra whitespace
    const trimmedTitles = titles.map((t) => t.trim()).filter((t) => t.length > 0);

    if (trimmedTitles.length === 0) {
      return { games: [], total: 0 };
    }

    const whereConditions = [VISIBLE_GAMES_SQL];

    // Create query with parameters for titles
    const placeholders = trimmedTitles.map(() => '?').join(',');
    whereConditions.push(`name COLLATE NOCASE IN (${placeholders})`);

    const queryParams: (string | number)[] = [...trimmedTitles];

    // Filter AI translations (shown by default, hidden if user enabled hideAiTranslations)
    if (hideAiTranslations) {
      whereConditions.push('ai IS NULL');
    }

    if (searchQuery) {
      const ftsQuery = buildFtsQuery(searchQuery);
      if (ftsQuery) {
        whereConditions.push(
          `id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)`
        );
        queryParams.push(ftsQuery);
      }
    }

    const stmt = this.db.prepare(`
      SELECT *
      FROM games
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${this.buildOrderClause(sortOrder)}
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    const games = rows.map((row) => this.rowToGame(row));

    return { games, total: games.length };
  }
}
