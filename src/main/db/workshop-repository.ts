import type Database from 'better-sqlite3';
import { generateSearchableString } from '../../shared/search-utils';
import type {
  GetWorkshopGamesParams,
  GetWorkshopGamesResult,
  WorkshopGame,
} from '../../shared/types';
import { getDatabase } from './database';

interface WorkshopGameInsertParams {
  id: string;
  workshop_id: string;
  steam_app_id: number | null;
  name: string;
  name_search: string;
  team: string | null;
  game_name: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

function workshopGameToInsertParams(game: WorkshopGame): WorkshopGameInsertParams {
  return {
    id: game.id,
    workshop_id: game.workshop_id,
    steam_app_id: game.steam_app_id ?? null,
    name: game.name,
    name_search: generateSearchableString(game.name),
    team: game.team ?? null,
    game_name: game.game_name ?? null,
    thumbnail_url: game.thumbnail_url ?? null,
    created_at: game.created_at,
    updated_at: game.updated_at,
  };
}

const SYNCED_COLUMNS = [
  'workshop_id',
  'steam_app_id',
  'name',
  'name_search',
  'team',
  'game_name',
  'thumbnail_url',
  'created_at',
  'updated_at',
] as const;

/**
 * ON CONFLICT DO UPDATE (не INSERT OR REPLACE), щоб не зачіпати колонки,
 * не перелічені тут - той самий підхід, що й для games (див. db-queries.ts).
 */
const UPSERT_WORKSHOP_GAME_SQL = `
  INSERT INTO workshop_games (
    id, ${SYNCED_COLUMNS.join(', ')}
  ) VALUES (
    @id, ${SYNCED_COLUMNS.map((c) => `@${c}`).join(', ')}
  )
  ON CONFLICT(id) DO UPDATE SET
    ${SYNCED_COLUMNS.map((c) => `${c} = excluded.${c}`).join(',\n    ')}
`;

/**
 * Repository для роботи з Steam Workshop перекладами в локальній базі даних.
 * Повністю незалежний від GamesRepository/games - окрема таблиця, окрема синхронізація.
 */
export class WorkshopGamesRepository {
  private static instance: WorkshopGamesRepository | null = null;
  private db: Database.Database;

  private constructor() {
    this.db = getDatabase();
  }

  static getInstance(): WorkshopGamesRepository {
    if (!WorkshopGamesRepository.instance) {
      WorkshopGamesRepository.instance = new WorkshopGamesRepository();
    }
    return WorkshopGamesRepository.instance;
  }

  private rowToWorkshopGame(row: Record<string, unknown>): WorkshopGame {
    return {
      id: row.id as string,
      workshop_id: row.workshop_id as string,
      steam_app_id: (row.steam_app_id as number | null) ?? null,
      name: row.name as string,
      team: (row.team as string | null) ?? null,
      game_name: (row.game_name as string) ?? null,
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  /**
   * Отримати Workshop-переклади з фільтрацією за назвою.
   * Оскільки це local-first застосунок, повертаємо всі одразу (без пагінації).
   */
  getWorkshopGames(params: GetWorkshopGamesParams = {}): GetWorkshopGamesResult {
    const { searchQuery = '' } = params;

    const whereConditions: string[] = [];
    const queryParams: string[] = [];

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      whereConditions.push('name_search LIKE ?');
      queryParams.push(`%${generateSearchableString(trimmedQuery)}%`);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stmt = this.db.prepare(`
      SELECT *
      FROM workshop_games
      ${whereClause}
      ORDER BY name COLLATE NOCASE ASC
    `);

    const rows = stmt.all(...queryParams) as Record<string, unknown>[];
    const games = rows.map((row) => this.rowToWorkshopGame(row));

    return { games, total: games.length };
  }

  getWorkshopGameById(id: string): WorkshopGame | null {
    const row = this.db.prepare('SELECT * FROM workshop_games WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToWorkshopGame(row) : null;
  }

  upsertWorkshopGame(game: WorkshopGame): void {
    const stmt = this.db.prepare(UPSERT_WORKSHOP_GAME_SQL);
    stmt.run(workshopGameToInsertParams(game));
  }

  upsertWorkshopGames(games: WorkshopGame[]): void {
    const upsert = this.db.transaction((gamesToInsert: WorkshopGame[]) => {
      const stmt = this.db.prepare(UPSERT_WORKSHOP_GAME_SQL);
      for (const game of gamesToInsert) {
        stmt.run(workshopGameToInsertParams(game));
      }
    });
    upsert(games);
  }

  deleteWorkshopGame(id: string): void {
    this.db.prepare('DELETE FROM workshop_games WHERE id = ?').run(id);
  }

  getLastUpdatedAt(): string | null {
    const result = this.db
      .prepare('SELECT MAX(updated_at) as max_updated_at FROM workshop_games')
      .get() as { max_updated_at: string | null };
    return result.max_updated_at;
  }
}
