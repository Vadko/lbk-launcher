import type { Game } from '@/shared/types';
import { parseTagIds } from './db-queries';

// Only the JSON columns need parsing; the integer flags become booleans
export function rowToGame(row: Record<string, unknown>): Game {
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
