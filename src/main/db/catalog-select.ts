import { TRANSLATION_RANK_SQL } from './translation-rating-sql';

// getGameGroupKey() in SQL
const GROUP_KEY_SQL = `CASE
  WHEN steam_app_id IS NOT NULL THEN 'steam:' || steam_app_id
  WHEN slug IS NOT NULL AND slug != '' THEN 'slug:' || slug
  ELSE 'id:' || id
END`;

interface CatalogSelect {
  where: string;
  order: string;
  limited?: boolean;
  grouped?: boolean;
}

// Grouped, each game's translations follow one another where its first one falls in the order, best first, as the sidebar shows them; params bind where, order, limit
export function catalogSelectSql({
  where,
  order,
  limited = false,
  grouped = true,
}: CatalogSelect): string {
  const limit = limited ? 'LIMIT ?' : '';
  if (!grouped) {
    return `SELECT * FROM games WHERE ${where} ORDER BY ${order} ${limit}`;
  }
  return `
    WITH matched AS (SELECT * FROM games WHERE ${where}),
    listed AS (SELECT id, row_number() OVER (ORDER BY ${order}) AS position FROM matched)
    SELECT matched.* FROM matched JOIN listed USING (id)
    ORDER BY MIN(listed.position) OVER (PARTITION BY ${GROUP_KEY_SQL}),
      ${TRANSLATION_RANK_SQL}, listed.position
    ${limit}`;
}
