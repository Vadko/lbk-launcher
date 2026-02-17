import got from 'got';
import type { Game } from '../../shared/types';
import { getSupabaseCredentials } from './supabase-credentials';

/**
 * API для синхронізації з Supabase через REST API
 * Цей модуль викликається ТІЛЬКИ в main process
 */

/** Timeout для запитів до Supabase REST API */
const REQUEST_TIMEOUT = {
  lookup: 5000,
  connect: 5000,
  secureConnect: 5000,
  response: 15_000,
};

/**
 * Поля, які НЕ потрібно завантажувати (великі file_list та FTS поля)
 */
type ExcludedFields =
  | 'archive_file_list'
  | 'voice_archive_file_list'
  | 'achievements_archive_file_list'
  | 'epic_archive_file_list'
  | 'name_fts'
  | 'name_search';

/**
 * Колонки для вибірки (type-safe)
 */
const GAME_SELECT_COLUMNS: (keyof Omit<Game, ExcludedFields>)[] = [
  'id',
  'slug',
  'name',
  'version',
  'translation_progress',
  'editing_progress',
  'team',
  'game_description',
  'description',
  'support_url',
  'video_url',
  'platforms',
  'status',
  'approved',
  'approved_at',
  'approved_by',
  'banner_path',
  'logo_path',
  'thumbnail_path',
  'capsule_path',
  'archive_path',
  'archive_size',
  'archive_hash',
  'created_by',
  'project_id',
  'created_at',
  'updated_at',
  'install_paths',
  'installation_file_linux_path',
  'installation_file_windows_path',
  'fonts_progress',
  'textures_progress',
  'voice_progress',
  'telegram',
  'youtube',
  'twitter',
  'website',
  'discord',
  'is_adult',
  'license_only',
  'fundraising_goal',
  'fundraising_current',
  'downloads',
  'subscriptions',
  'voice_archive_path',
  'voice_archive_hash',
  'voice_archive_size',
  'achievements_archive_path',
  'achievements_archive_hash',
  'achievements_archive_size',
  'achievements_third_party',
  'steam_app_id',
  'epic_archive_path',
  'epic_archive_hash',
  'epic_archive_size',
  'ai',
  'hide',
  'additional_path',
];

const GAME_SELECT_STRING = GAME_SELECT_COLUMNS.join(',');

/**
 * Виконати запит до Supabase REST API
 */
function supabaseRequest<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  return got(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    timeout: REQUEST_TIMEOUT,
    retry: { limit: 3 },
  }).json<T[]>();
}

/**
 * Завантажити всі затверджені ігри з Supabase
 */
export async function fetchAllGamesFromSupabase(): Promise<Game[]> {
  const allGames: Game[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await supabaseRequest<Game>('games', {
      select: GAME_SELECT_STRING,
      approved: 'eq.true',
      order: 'name.asc',
      offset: offset.toString(),
      limit: pageSize.toString(),
    });

    if (data && data.length > 0) {
      allGames.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }

    console.log(`[SupabaseSync] Fetched ${allGames.length} games so far...`);
  }

  console.log(`[SupabaseSync] Total fetched: ${allGames.length} games`);
  return allGames;
}

/**
 * Завантажити ігри оновлені після певної дати
 */
export async function fetchUpdatedGamesFromSupabase(since: string): Promise<Game[]> {
  const allGames: Game[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  console.log(`[SupabaseSync] Fetching games updated since ${since}`);

  while (hasMore) {
    const data = await supabaseRequest<Game>('games', {
      select: GAME_SELECT_STRING,
      approved: 'eq.true',
      updated_at: `gt.${since}`,
      order: 'updated_at.asc',
      offset: offset.toString(),
      limit: pageSize.toString(),
    });

    if (data && data.length > 0) {
      allGames.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`[SupabaseSync] Fetched ${allGames.length} updated games`);
  return allGames;
}

/**
 * Завантажити ID ігор видалених після певної дати
 * Якщо since не вказано - повертає всі видалені ігри
 */
export async function fetchDeletedGameIdsFromSupabase(since?: string): Promise<string[]> {
  if (since) {
    console.log(`[SupabaseSync] Fetching deleted games since ${since}`);
  } else {
    console.log(`[SupabaseSync] Fetching all deleted games`);
  }

  const params: Record<string, string> = {
    select: 'game_id',
  };

  if (since) {
    params.deleted_at = `gt.${since}`;
  }

  const data = await supabaseRequest<{ game_id: string }>('deleted_games', params);

  const deletedIds = data.map((row) => row.game_id);
  console.log(`[SupabaseSync] Fetched ${deletedIds.length} deleted game IDs`);
  return deletedIds;
}

interface TrendingGame {
  game_id: string;
  downloads: number;
}

/**
 * Завантажити найпопулярніші ігри за останні N днів
 * @param days - кількість днів для аналізу
 * @param limit - максимальна кількість ігор
 * @returns масив {game_id, downloads}
 */
export async function fetchTrendingGames(days = 30, limit = 10): Promise<TrendingGame[]> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

  console.log(`[SupabaseSync] Fetching trending games for last ${days} days`);

  try {
    const data = await got
      .post(`${SUPABASE_URL}/rest/v1/rpc/get_trending_games`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        json: { p_days: days, p_limit: limit },
        timeout: REQUEST_TIMEOUT,
        retry: { limit: 3 },
      })
      .json<TrendingGame[]>();

    console.log(`[SupabaseSync] Fetched ${data.length} trending games`);
    return data;
  } catch (error) {
    console.error('[SupabaseSync] Failed to fetch trending games:', error);
    return [];
  }
}
