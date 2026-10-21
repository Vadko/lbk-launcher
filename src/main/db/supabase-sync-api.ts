import type { Database } from '../../lib/database.types';
import type { Game } from '../../shared/types';
import { getSupabaseClient } from './supabase-client';
import { afterCursor, collectPages, keysetPages } from './sync-cursor';

/**
 * API for syncing with Supabase via the typed supabase-js client.
 * This module is called ONLY in the main process.
 */

export type TagNameRow = Database['public']['Tables']['steam_tag_names']['Row'];

/**
 * Fields that should NOT be loaded (large file_list and FTS fields)
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
  | 'name_search'
  // Milestone counters live locally only: the server doesn't send them back, and the
  // guard below would otherwise treat them as forgotten.
  | 'last_download_milestone'
  | 'last_subscriber_milestone';

/**
 * Columns for selection (type-safe)
 */
const GAME_SELECT_COLUMNS = [
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
  'steam_launch_options_macos',
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
  'steam_tag_ids',
  'kind',
  'workshop_id',
  'likes',
] as const satisfies readonly (keyof Omit<Game, ExcludedFields>)[];

function _assertNever<_T extends never>(): void {
  /* only for compiler */
}
_assertNever<
  Exclude<keyof Omit<Game, ExcludedFields>, (typeof GAME_SELECT_COLUMNS)[number]>
>();

const GAME_SELECT_STRING = GAME_SELECT_COLUMNS.join(',');

const GAMES_PAGE_SIZE = 100;
const TAG_NAMES_PAGE_SIZE = 500;

const DELETED_GAMES_PAGE_SIZE = 1000;

const isLastPage =
  (pageSize: number) =>
  (page: unknown[]): boolean =>
    page.length < pageSize;

/**
 * Fetch all approved games from Supabase
 */
export async function fetchAllGamesFromSupabase(): Promise<Game[]> {
  const supabase = getSupabaseClient();
  const pages = keysetPages(async (last: Game | undefined) => {
    const query = supabase.from('games').select(GAME_SELECT_STRING).eq('approved', true);
    const { data, error } = await (last ? query.gt('id', last.id) : query)
      .order('id', { ascending: true })
      .limit(GAMES_PAGE_SIZE)
      .overrideTypes<Game[], { merge: false }>();
    if (error) {
      throw error;
    }
    return data;
  }, isLastPage(GAMES_PAGE_SIZE));

  const allGames = await collectPages(pages);
  console.log(`[SupabaseSync] Total fetched: ${allGames.length} games`);
  return allGames;
}

/**
 * Fetch games updated after a certain date
 */
export async function fetchUpdatedGamesFromSupabase(since: string): Promise<Game[]> {
  const supabase = getSupabaseClient();
  console.log(`[SupabaseSync] Fetching games updated since ${since}`);

  const pages = keysetPages(async (last: Game | undefined) => {
    const query = supabase
      .from('games')
      .select(GAME_SELECT_STRING)
      .eq('approved', true)
      .gt('updated_at', since);
    const { data, error } = await (last
      ? query.or(afterCursor('updated_at', last.updated_at, 'id', last.id))
      : query
    )
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(GAMES_PAGE_SIZE)
      .overrideTypes<Game[], { merge: false }>();
    if (error) {
      throw error;
    }
    return data;
  }, isLastPage(GAMES_PAGE_SIZE));

  const allGames = await collectPages(pages);
  console.log(`[SupabaseSync] Fetched ${allGames.length} updated games`);
  return allGames;
}

export type DeletedGame = Pick<
  Database['public']['Tables']['deleted_games']['Row'],
  'id' | 'game_id' | 'deleted_at'
>;

export async function fetchDeletedGamesFromSupabase(
  since?: string
): Promise<DeletedGame[]> {
  const supabase = getSupabaseClient();
  console.log(`[SupabaseSync] Fetching deleted games${since ? ` since ${since}` : ''}`);

  const pages = keysetPages(async (last: DeletedGame | undefined) => {
    const query = supabase.from('deleted_games').select('id,game_id,deleted_at');
    const sinceQuery = since ? query.gt('deleted_at', since) : query;
    const { data, error } = await (last
      ? sinceQuery.or(afterCursor('deleted_at', last.deleted_at, 'id', last.id))
      : sinceQuery
    )
      .order('deleted_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(DELETED_GAMES_PAGE_SIZE);
    if (error) {
      throw error;
    }
    return data;
  }, isLastPage(DELETED_GAMES_PAGE_SIZE));

  const rows = await collectPages(pages);
  console.log(`[SupabaseSync] Fetched ${rows.length} deleted games`);
  return rows;
}

/** Result row of the get_trending_games RPC */
type TrendingGame =
  Database['public']['Functions']['get_trending_games']['Returns'][number];

/**
 * Fetch the most popular games over the last N days
 * @param days - number of days to analyze
 * @param limit - maximum number of games
 * @returns array of {game_id, downloads}
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

export async function fetchTagNamesFromSupabase(since?: string): Promise<TagNameRow[]> {
  const supabase = getSupabaseClient();
  const pages = keysetPages(async (last: TagNameRow | undefined) => {
    const query = supabase.from('steam_tag_names').select('tagid,name,updated_at');
    const sinceQuery = since ? query.gt('updated_at', since) : query;
    const { data, error } = await (last
      ? sinceQuery.or(afterCursor('updated_at', last.updated_at, 'tagid', last.tagid))
      : sinceQuery
    )
      .order('updated_at', { ascending: true })
      .order('tagid', { ascending: true })
      .limit(TAG_NAMES_PAGE_SIZE);
    if (error) {
      throw error;
    }
    return data;
  }, isLastPage(TAG_NAMES_PAGE_SIZE));

  const rows = await collectPages(pages);
  console.log(`[SupabaseSync] Fetched ${rows.length} tag names`);
  return rows;
}
