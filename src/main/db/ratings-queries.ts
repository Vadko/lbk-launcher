import type {
  GameRatingItem,
  RatingsPageInput,
  TeamRatingItem,
} from '../../shared/ratings-api-types';
import { getDatabase } from './database';
import { VISIBLE_GAMES_SQL } from './db-queries';

const visibleSql = (hideAi: boolean) =>
  hideAi ? `${VISIBLE_GAMES_SQL} AND ai IS NULL` : VISIBLE_GAMES_SQL;

// Splits team on commas the way teamMembers() does, so a row matches the catalog's author filter
const teamsCte = (hideAi: boolean) => `
  WITH RECURSIVE split(game_id, likes, downloads, author, rest) AS (
    SELECT id, COALESCE(likes, 0), COALESCE(downloads, 0), '', team || ','
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

export function getTeamsRating({
  offset,
  limit,
  hideAi,
}: RatingsPageInput): TeamRatingItem[] {
  return getDatabase()
    .prepare<[number, number], TeamRatingItem>(
      `${teamsCte(hideAi)}
      SELECT author AS name, SUM(likes) AS likes, COUNT(*) AS translations,
        SUM(downloads) AS downloads
      FROM team_games
      GROUP BY author
      ORDER BY likes DESC, translations DESC, name COLLATE NOCASE, name
      LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}

export function getGamesRating({
  offset,
  limit,
  hideAi,
}: RatingsPageInput): GameRatingItem[] {
  return getDatabase()
    .prepare<[number, number], GameRatingItem>(
      `SELECT id, name, COALESCE(likes, 0) AS likes,
        COALESCE(downloads, 0) AS downloads, status
      FROM games
      WHERE ${visibleSql(hideAi)}
      ORDER BY likes DESC, downloads DESC, name COLLATE NOCASE, id
      LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
}
