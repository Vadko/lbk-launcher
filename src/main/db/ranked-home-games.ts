import type { Game } from '@/shared/types';
import { getDatabase } from './database';
import { VISIBLE_GAMES_SQL } from './db-queries';
import { rowToGame } from './row-to-game';
import { TRANSLATION_RATING_SQL } from './translation-rating-sql';

// A translation joins the popular section at this many downloads and leaves the new stars one for it
const POPULAR_MIN_DOWNLOADS = 70;
const NEW_STAR_DAYS = 21;
const RANKED_LIMIT = 30;

function readRanked(hideAi: boolean, where: string, params: (string | number)[]): Game[] {
  const rows = getDatabase()
    .prepare<(string | number)[], Record<string, unknown>>(
      `SELECT * FROM games
       WHERE ${VISIBLE_GAMES_SQL}${hideAi ? ' AND ai IS NULL' : ''} AND ${where}
       ORDER BY ${TRANSLATION_RATING_SQL} DESC, id
       LIMIT ?`
    )
    .all(...params, RANKED_LIMIT);
  return rows.map(rowToGame);
}

export function getPopularGames(hideAi: boolean): Game[] {
  return readRanked(hideAi, 'COALESCE(downloads, 0) >= ?', [POPULAR_MIN_DOWNLOADS]);
}

// A planned translation has nothing to download, so it could never earn its way out
export function getNewStarGames(hideAi: boolean): Game[] {
  return readRanked(
    hideAi,
    `COALESCE(downloads, 0) < ? AND status != 'planned'
       AND julianday(created_at) >= julianday('now', ?)`,
    [POPULAR_MIN_DOWNLOADS, `-${NEW_STAR_DAYS} days`]
  );
}
