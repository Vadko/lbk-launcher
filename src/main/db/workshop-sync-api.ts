import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkshopGame } from '../../shared/types';
import { getSupabaseCredentials } from './supabase-credentials';

/**
 * API для синхронізації Steam Workshop перекладів з Supabase.
 * Цей модуль викликається ТІЛЬКИ в main process.
 *
 * Використовує окремий, НЕТИПІЗОВАНИЙ supabase-js клієнт: `workshop_games` і
 * `deleted_workshop_games` відсутні в codegen'нутому `Database` типі
 * (../../lib/database.types.ts), тому типізований клієнт із games-sync
 * (supabase-client.ts) не прийме ці назви таблиць. Якщо колись перегенерують
 * типи Supabase з цими таблицями - можна прибрати цей клієнт і використовувати
 * спільний типізований getSupabaseClient().
 */
let workshopSupabaseClient: SupabaseClient | null = null;

function getWorkshopSupabaseClient(): SupabaseClient {
  if (!workshopSupabaseClient) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();
    workshopSupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { timeout: 30_000 },
    });
  }
  return workshopSupabaseClient;
}

const WORKSHOP_GAME_SELECT_STRING = [
  'id',
  'workshop_id',
  'steam_app_id',
  'name',
  'team',
  'game_name',
  'thumbnail_url',
  'created_at',
  'updated_at',
].join(',');

const WORKSHOP_GAMES_PAGE_SIZE = 100;

/**
 * Завантажити всі затверджені Workshop-переклади з Supabase
 */
export async function fetchAllWorkshopGamesFromSupabase(): Promise<WorkshopGame[]> {
  const supabase = getWorkshopSupabaseClient();
  const allGames: WorkshopGame[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('workshop_games')
      .select(WORKSHOP_GAME_SELECT_STRING)
      .eq('approved', true)
      .order('name', { ascending: true })
      .range(offset, offset + WORKSHOP_GAMES_PAGE_SIZE - 1)
      .overrideTypes<WorkshopGame[], { merge: false }>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    allGames.push(...rows);
    offset += WORKSHOP_GAMES_PAGE_SIZE;
    hasMore = rows.length === WORKSHOP_GAMES_PAGE_SIZE;

    console.log(`[WorkshopSync] Fetched ${allGames.length} workshop games so far...`);
  }

  console.log(`[WorkshopSync] Total fetched: ${allGames.length} workshop games`);
  return allGames;
}

/**
 * Завантажити Workshop-переклади оновлені після певної дати
 */
export async function fetchUpdatedWorkshopGamesFromSupabase(
  since: string
): Promise<WorkshopGame[]> {
  const supabase = getWorkshopSupabaseClient();
  const allGames: WorkshopGame[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`[WorkshopSync] Fetching workshop games updated since ${since}`);

  while (hasMore) {
    const { data, error } = await supabase
      .from('workshop_games')
      .select(WORKSHOP_GAME_SELECT_STRING)
      .eq('approved', true)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .range(offset, offset + WORKSHOP_GAMES_PAGE_SIZE - 1)
      .overrideTypes<WorkshopGame[], { merge: false }>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    allGames.push(...rows);
    offset += WORKSHOP_GAMES_PAGE_SIZE;
    hasMore = rows.length === WORKSHOP_GAMES_PAGE_SIZE;
  }

  console.log(`[WorkshopSync] Fetched ${allGames.length} updated workshop games`);
  return allGames;
}

/**
 * Завантажити ID Workshop-перекладів видалених після певної дати.
 * Якщо since не вказано - повертає всі видалені.
 */
export async function fetchDeletedWorkshopGameIdsFromSupabase(
  since?: string
): Promise<string[]> {
  const supabase = getWorkshopSupabaseClient();

  const query = supabase.from('deleted_workshop_games').select('id');
  const { data, error } = await (since ? query.gt('deleted_at', since) : query);

  if (error) {
    throw error;
  }

  const deletedIds = (data ?? []).map((row: { id: string }) => row.id);
  console.log(`[WorkshopSync] Fetched ${deletedIds.length} deleted workshop game IDs`);
  return deletedIds;
}
