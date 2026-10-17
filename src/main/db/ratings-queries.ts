import type { GameRatingItem, RatingsPage, TeamRatingItem } from '../../shared/types';
import { getDatabase } from './database';
import { VISIBLE_GAMES_SQL } from './db-queries';

const visibleSql = (hideAi: boolean) =>
  hideAi ? `${VISIBLE_GAMES_SQL} AND ai IS NULL` : VISIBLE_GAMES_SQL;

const teamsCte = (hideAi: boolean) => `
  WITH RECURSIVE split(game_id, likes, downloads, author, rest) AS (
    SELECT id, COALESCE(likes_count, 0), COALESCE(downloads, 0), '', team || ','
    FROM games
    WHERE ${visibleSql(hideAi)} AND team IS NOT NULL AND team != ''
    UNION ALL
    SELECT game_id, likes, downloads,
      trim(substr(rest, 1, instr(rest, ',') - 1)),
      substr(rest, instr(rest, ',') + 1)
    FROM split
    WHERE rest != ''
  ),
  team_games AS (
    SELECT DISTINCT game_id, author, likes, downloads FROM split WHERE author != ''
  )
`;

export function getTeamsRating(
  page: number,
  pageSize: number,
  hideAi: boolean
): RatingsPage<TeamRatingItem> {
  const db = getDatabase();
  const total = (
    db
      .prepare(
        `${teamsCte(hideAi)} SELECT COUNT(DISTINCT author) AS total FROM team_games`
      )
      .get() as { total: number }
  ).total;
  const items = db
    .prepare(
      `${teamsCte(hideAi)}
      SELECT author AS name, SUM(likes) AS likes, COUNT(*) AS translations,
        SUM(downloads) AS downloads
      FROM team_games
      GROUP BY author
      ORDER BY likes DESC, translations DESC, name COLLATE NOCASE
      LIMIT ? OFFSET ?`
    )
    .all(pageSize, (page - 1) * pageSize) as TeamRatingItem[];
  return { items, total, pageSize };
}

export function getGamesRating(
  page: number,
  pageSize: number,
  hideAi: boolean
): RatingsPage<GameRatingItem> {
  const db = getDatabase();
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS total FROM games WHERE ${visibleSql(hideAi)}`)
      .get() as {
      total: number;
    }
  ).total;
  const items = db
    .prepare(
      `SELECT id, name, COALESCE(likes_count, 0) AS likes,
        COALESCE(downloads, 0) AS downloads, status
      FROM games
      WHERE ${visibleSql(hideAi)}
      ORDER BY likes DESC, downloads DESC, name COLLATE NOCASE
      LIMIT ? OFFSET ?`
    )
    .all(pageSize, (page - 1) * pageSize) as GameRatingItem[];
  return { items, total, pageSize };
}
