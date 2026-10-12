import { existsSync, type FSWatcher, readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { buildFtsQuery, stripApostrophes } from '../../shared/search-utils';
import type {
  FacetRow,
  Game,
  GetGamesParams,
  GetGamesResult,
  SortOrderType,
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

const FTS_MATCH_SQL = 'id IN (SELECT game_id FROM games_fts WHERE games_fts MATCH ?)';

/**
 * Repository for working with games in the local database
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
   * Read and parse test/games.json
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
   * Watch for changes in test/games.json
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
   * Notify the renderer process about changes in games
   */
  private notifyGamesChanged(): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      window.webContents.send('test-games-changed');
    });
  }

  /**
   * Load test games from test/games.json in development mode
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
   * Build the ORDER BY clause for sorting games
   */
  private buildOrderClause(sortOrder: SortOrderType): string {
    // LTRIM strips digits and symbols from the start of the name for sorting
    // E.g. "112 Operator" sorts as "Operator", "[Chilla's Art]" as "Chilla's Art"
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
   * Convert a row from SQLite into a Game
   * Only the platforms and install_paths fields need JSON.parse
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
      ai: row.ai as string | null, // ai is now a text field: 'edited' | 'non-edited' | null
      hide: Boolean(row.hide),
      achievements_third_party: row.achievements_third_party || null,
      platforms,
      install_paths,
      screenshots,
      steam_tag_ids,
    } as Game;
  }

  /**
   * Get games with filtering
   * Since this is a local-first app, we return all games at once
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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

  // One search predicate for every list and the facet counts, so a count never disagrees with its list
  private buildSearchCondition(
    searchQuery?: string
  ): { sql: string; params: string[] } | null {
    const query = searchQuery?.trim();
    if (!query) {
      return null;
    }

    // 1-char queries use a name prefix LIKE (an FTS prefix scan is expensive); no usable tokens fall back to substring LIKE
    const ftsQuery = query.length >= 2 ? buildFtsQuery(query) : '';
    const condition = ftsQuery
      ? { sql: FTS_MATCH_SQL, params: [ftsQuery] }
      : { sql: 'name LIKE ?', params: [query.length >= 2 ? `%${query}%` : `${query}%`] };

    if (!isSpellfixAvailable() || this.hasVisibleMatch(condition)) {
      return condition;
    }

    // Typo fallback is decided on the search alone, so the other filters still apply to its matches
    const correctedFts = this.correctFtsQuery(query);
    return correctedFts ? { sql: FTS_MATCH_SQL, params: [correctedFts] } : condition;
  }

  private hasVisibleMatch(condition: { sql: string; params: string[] }): boolean {
    return (
      this.db
        .prepare(
          `SELECT 1 FROM games WHERE ${VISIBLE_GAMES_SQL} AND ${condition.sql} LIMIT 1`
        )
        .get(...condition.params) !== undefined
    );
  }

  /** Spellfix1: replace each query word with its closest dictionary word, as an FTS5 OR query */
  private correctFtsQuery(searchQuery: string): string | null {
    try {
      // spellfix dictionary has no apostrophes (extractUniqueWords), so strip the query too
      const queryWords = stripApostrophes(searchQuery)
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      if (queryWords.length === 0) {
        return null;
      }

      const spellfixStmt = this.db.prepare(
        'SELECT word FROM spellfix_words WHERE word MATCH ? AND top=5 ORDER BY score LIMIT 1'
      );
      const correctedWords = queryWords.map((word) => {
        const result = spellfixStmt.get(word) as { word: string } | undefined;
        return result ? result.word : word;
      });

      return correctedWords.map((w) => `"${w}"*`).join(' OR ');
    } catch (e) {
      console.warn('[GamesRepository] Spellfix fuzzy fallback error:', e);
      return null;
    }
  }

  /**
   * Get unique authors
   * Parses the comma-separated team field and returns unique authors
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
   * Get games by ID
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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

    return { games: matchedGames, total: matchedGames.length };
  }

  /**
   * Find games by Steam App IDs
   * Returns all translations, but total counts unique games (by steam_app_id)
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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
   * Insert or update a game (upsert)
   */
  upsertGame(game: Game): void {
    upsertGameSingle(this.db, game);
  }

  /**
   * Insert or update multiple games (batch upsert)
   */
  upsertGames(games: Game[]): void {
    upsertGamesTransaction(this.db, games);
  }

  /**
   * Increment the download counter for a game in the local DB
   */
  incrementDownloads(gameId: string): void {
    const stmt = this.db.prepare(
      'UPDATE games SET downloads = COALESCE(downloads, 0) + 1 WHERE id = ?'
    );
    stmt.run(gameId);
  }

  /** Subscriber count from the tracking response — holds until the next catalog sync */
  setSubscriptions(gameId: string, subscriptions: number): void {
    this.db
      .prepare('UPDATE games SET subscriptions = ? WHERE id = ?')
      .run(subscriptions, gameId);
  }

  /**
   * Unlock/lock a hidden game locally for the user.
   * Writes to `user_unlocked` - a local column that does NOT sync from Supabase
   * and therefore doesn't get wiped on the next database update (unlike directly
   * editing `hide`, which is always overwritten by the server's value).
   * In query WHERE conditions, hidden games are shown when `user_unlocked = 1`.
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
   * Steam App ID of every catalog game that has a translation — regardless of
   * the install method (Workshop or archive). Unlike
   * `getWorkshopTargets`, which only takes `kind = 'workshop'` (a rarity —
   * the vast majority of translations are installed via archive).
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
   * Delete a game
   */
  deleteGame(gameId: string): void {
    deleteGameById(this.db, gameId);
  }

  /**
   * Get the latest updated_at for synchronization
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
   * Get a game by ID
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
   * Tags for the filter: only those present in visible games, with localized names.
   * The JOIN with the dictionary also filters out ids whose names haven't synced yet.
   */
  getTagOptions(): TagOption[] {
    return this.db
      .prepare(
        `SELECT t.tagid AS tagid, t.name AS name,
                COUNT(DISTINCT COALESCE(
                  'steam:' || g.steam_app_id, 'slug:' || NULLIF(g.slug, ''), 'id:' || g.id
                )) AS count
         FROM games g
         JOIN json_each(g.steam_tag_ids) je
         JOIN steam_tag_names t ON t.tagid = je.value
         WHERE ${VISIBLE_GAMES_SQL}
         GROUP BY t.tagid, t.name
         ORDER BY count DESC, t.name`
      )
      .all() as TagOption[];
  }

  /** Every visible translation with just the columns the filters read, for renderer-side faceted counts */
  getFacetRows(): FacetRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, slug, steam_app_id, status, team, steam_tag_ids, ai, kind,
                achievements_archive_path, voice_archive_path, voice_progress
         FROM games
         WHERE ${VISIBLE_GAMES_SQL}
         ORDER BY id`
      )
      .all() as Array<Omit<FacetRow, 'steam_tag_ids'> & { steam_tag_ids: unknown }>;
    return rows.map((row) => ({ ...row, steam_tag_ids: parseTagIds(row.steam_tag_ids) }));
  }

  /** Visible ids matched by the sidebar search, for the facet counts */
  getSearchMatchIds(searchQuery: string): string[] {
    const search = this.buildSearchCondition(searchQuery);
    const rows = this.db
      .prepare(
        `SELECT id FROM games WHERE ${VISIBLE_GAMES_SQL}${search ? ` AND ${search.sql}` : ''}`
      )
      .all(...(search?.params ?? [])) as { id: string }[];
    return rows.map((row) => row.id);
  }

  /**
   * Find games by a list of Xbox installation folder names. Matches against
   * the `install_paths` JSON field (items `{type: 'xbox', path: 'FolderName'}`).
   * SQLite has no JSON array indexes, so we use json_each to
   * expand install_paths and a LIKE pattern to find the matching entry.
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
    // Each install_paths element is JSON {type, path}. We look for ones where
    // type='xbox' and path COLLATE NOCASE IN (folderNames).
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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
   * Find games by a list of titles (exact match, case-insensitive)
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

    const search = this.buildSearchCondition(searchQuery);
    if (search) {
      whereConditions.push(search.sql);
      queryParams.push(...search.params);
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
