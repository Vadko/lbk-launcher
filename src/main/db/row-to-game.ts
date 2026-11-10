import type { Game } from '@/shared/types';
import { type GameRow, parseTagIds } from './db-queries';

const parseJsonOrNull = (json: string | null) =>
  json === null ? null : JSON.parse(json);

// Only the JSON columns need parsing; the integer flags become booleans
export function rowToGame(row: GameRow): Game {
  return {
    ...row,
    approved: Boolean(row.approved),
    is_adult: Boolean(row.is_adult),
    license_only: Boolean(row.license_only),
    hide: Boolean(row.hide),
    achievements_third_party: row.achievements_third_party || null,
    platforms: JSON.parse(row.platforms),
    install_paths: parseJsonOrNull(row.install_paths),
    screenshots: parseJsonOrNull(row.screenshots),
    steam_tag_ids: parseTagIds(row.steam_tag_ids),
  };
}
