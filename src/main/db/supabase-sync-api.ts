import type { Database } from '../../lib/database.types';
import type { Game } from '../../shared/types';
import { getSupabaseClient } from './supabase-client';

/**
 * API для синхронізації з Supabase через типізований supabase-js клієнт.
 * Цей модуль викликається ТІЛЬКИ в main process.
 */

/**
 * Поля, які НЕ потрібно завантажувати (великі file_list та FTS поля)
 */
type ExcludedFields =
  | 'archive_file_list'
  | 'voice_archive_file_list'
  | 'achievements_archive_file_list'
  | 'epic_archive_file_list'
  | 'gog_archive_file_list'
  | 'xbox_archive_file_list'
  | 'uplay_archive_file_list'
  | 'ea_archive_file_list'
  | 'steam_linux_archive_file_list'
  | 'steam_mac_archive_file_list'
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
  'screenshots',
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
  'gog_archive_path',
  'gog_archive_hash',
  'gog_archive_size',
  'xbox_archive_path',
  'xbox_archive_hash',
  'xbox_archive_size',
  'uplay_archive_path',
  'uplay_archive_hash',
  'uplay_archive_size',
  'ea_archive_path',
  'ea_archive_hash',
  'ea_archive_size',
  'steam_linux_archive_path',
  'steam_linux_archive_hash',
  'steam_linux_archive_size',
  'steam_mac_archive_path',
  'steam_mac_archive_hash',
  'steam_mac_archive_size',
  'steam_launch_options_windows',
  'steam_launch_options_linux',
  'epic_store_url',
  'gog_store_url',
  'xbox_store_url',
  'uplay_store_url',
  'ea_store_url',
  'ai',
  'hide',
  'additional_path',
  'translation_updated_at',
  'source_language',
  'search_keywords',
];

const GAME_SELECT_STRING = GAME_SELECT_COLUMNS.join(',');

const GAMES_PAGE_SIZE = 100;

/**
 * Завантажити всі затверджені ігри з Supabase
 */
export async function fetchAllGamesFromSupabase(): Promise<Game[]> {
  const supabase = getSupabaseClient();
  const allGames: Game[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('games')
      .select(GAME_SELECT_STRING)
      .eq('approved', true)
      .order('name', { ascending: true })
      .range(offset, offset + GAMES_PAGE_SIZE - 1)
      .overrideTypes<Game[], { merge: false }>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    allGames.push(...rows);
    offset += GAMES_PAGE_SIZE;
    hasMore = rows.length === GAMES_PAGE_SIZE;

    console.log(`[SupabaseSync] Fetched ${allGames.length} games so far...`);
  }

  console.log(`[SupabaseSync] Total fetched: ${allGames.length} games`);
  return allGames;
}

/**
 * Завантажити ігри оновлені після певної дати
 */
export async function fetchUpdatedGamesFromSupabase(since: string): Promise<Game[]> {
  const supabase = getSupabaseClient();
  const allGames: Game[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`[SupabaseSync] Fetching games updated since ${since}`);

  while (hasMore) {
    const { data, error } = await supabase
      .from('games')
      .select(GAME_SELECT_STRING)
      .eq('approved', true)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .range(offset, offset + GAMES_PAGE_SIZE - 1)
      .overrideTypes<Game[], { merge: false }>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    allGames.push(...rows);
    offset += GAMES_PAGE_SIZE;
    hasMore = rows.length === GAMES_PAGE_SIZE;
  }

  console.log(`[SupabaseSync] Fetched ${allGames.length} updated games`);
  return allGames;
}

/**
 * Завантажити ID ігор видалених після певної дати
 * Якщо since не вказано - повертає всі видалені ігри
 */
export async function fetchDeletedGameIdsFromSupabase(since?: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  if (since) {
    console.log(`[SupabaseSync] Fetching deleted games since ${since}`);
  } else {
    console.log(`[SupabaseSync] Fetching all deleted games`);
  }

  const query = supabase.from('deleted_games').select('game_id');
  const { data, error } = await (since ? query.gt('deleted_at', since) : query);

  if (error) {
    throw error;
  }

  const deletedIds = (data ?? []).map((row) => row.game_id);
  console.log(`[SupabaseSync] Fetched ${deletedIds.length} deleted game IDs`);
  return deletedIds;
}

/** Рядок результату RPC get_trending_games */
type TrendingGame =
  Database['public']['Functions']['get_trending_games']['Returns'][number];

/**
 * Завантажити найпопулярніші ігри за останні N днів
 * @param days - кількість днів для аналізу
 * @param limit - максимальна кількість ігор
 * @returns масив {game_id, downloads}
 */
export async function fetchTrendingGames(days = 30, limit = 10): Promise<TrendingGame[]> {
  const supabase = getSupabaseClient();

  console.log(`[SupabaseSync] Fetching trending games for last ${days} days`);

  const { data, error } = await supabase.rpc('get_trending_games', {
    p_days: days,
    p_limit: limit,
  });

  if (error) {
    console.error('[SupabaseSync] Failed to fetch trending games:', error);
    return [];
  }

  console.log(`[SupabaseSync] Fetched ${data?.length ?? 0} trending games`);
  return data ?? [];
}
