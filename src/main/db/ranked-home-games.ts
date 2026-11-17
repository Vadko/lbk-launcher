import type { Game } from '@/shared/types';
import { getDatabase } from './database';
import { type GameRow, VISIBLE_GAMES_SQL } from './db-queries';
import { rowToGame } from './row-to-game';
import { TRANSLATION_RATING_SQL } from './translation-rating-sql';

// A translation joins the popular section at this many downloads and leaves the new stars one for it
const POPULAR_MIN_DOWNLOADS = 70;
const NEW_STAR_DAYS = 21;
const RANKED_LIMIT = 30;
const BY_RATING = `${TRANSLATION_RATING_SQL} DESC`;

function readRanked(
  hideAi: boolean,
  where: string,
  orderBy: string,
  params: (string | number)[]
): Game[] {
  const rows = getDatabase()
    .prepare<(string | number)[], GameRow>(
      `SELECT * FROM games
       WHERE ${VISIBLE_GAMES_SQL}${hideAi ? ' AND ai IS NULL' : ''} AND ${where}
       ORDER BY ${orderBy}, id
       LIMIT ?`
    )
    .all(...params, RANKED_LIMIT);
  return rows.map(rowToGame);
}

const readPopular = (hideAi: boolean, orderBy: string) =>
  readRanked(hideAi, 'COALESCE(downloads, 0) >= ?', orderBy, [POPULAR_MIN_DOWNLOADS]);

// The total breaks ties, which also orders the list before the counters catch-up fills downloads_30d
export function getPopularGames(hideAi: boolean): Game[] {
  return readPopular(
    hideAi,
    'COALESCE(downloads_30d, 0) DESC, COALESCE(downloads, 0) DESC'
  );
}

export function getPopularAllTimeGames(hideAi: boolean): Game[] {
  return readPopular(hideAi, BY_RATING);
}

// A planned translation has nothing to download, so it could never earn its way out
export function getNewStarGames(hideAi: boolean): Game[] {
  return readRanked(
    hideAi,
    `COALESCE(downloads, 0) < ? AND status != 'planned'
       AND julianday(created_at) >= julianday('now', ?)`,
    BY_RATING,
    [POPULAR_MIN_DOWNLOADS, `-${NEW_STAR_DAYS} days`]
  );
}
