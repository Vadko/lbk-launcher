import { getDatabase } from './database';
import { VISIBLE_GAMES_SQL } from './db-queries';

// Team names are Cyrillic and SQLite's lower() folds ASCII only, so the team match stays in JS
export function findDeepLinkGameId(slug: string, team: string): string | null {
  const wanted = team.toLowerCase();
  const rows = getDatabase()
    .prepare(
      `SELECT id, team FROM games WHERE COALESCE(NULLIF(slug, ''), id) = ? AND ${VISIBLE_GAMES_SQL}`
    )
    .all(slug) as { id: string; team: string }[];
  const match = rows.find((row) => {
    const teams = row.team.toLowerCase();
    return teams === wanted || teams.split(',').some((name) => name.trim() === wanted);
  });
  return match?.id ?? null;
}
