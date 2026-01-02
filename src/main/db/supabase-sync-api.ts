import type { Game } from '../../shared/types';

/**
 * API для синхронізації з Supabase через REST API
 * Цей модуль викликається ТІЛЬКИ в main process
 * Використовує fetch замість Supabase client для уникнення проблем з ESM/CommonJS
 */

/**
 * Отримати Supabase credentials
 */
function getSupabaseCredentials() {
  // В main process використовуємо import.meta.env (Vite)
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}

/**
 * Виконати запит до Supabase REST API
 */
async function supabaseRequest<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
