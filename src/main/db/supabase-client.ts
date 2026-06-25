import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import { getSupabaseCredentials } from './supabase-credentials';

/**
 * Спільний типізований supabase-js клієнт для main process (REST-вибірки).
 *
 * supabase-js (postgrest-js) має вбудовані retry і timeout:
 * - retry: до 3 спроб з експоненційним backoff на мережевих помилках та
 *   статусах 503/520 (тільки ідемпотентні GET/HEAD/OPTIONS);
 * - timeout: опція db.timeout — postgrest сам обгортає fetch в AbortController
 *   per-attempt і чистить таймер.
 */

/** Таймаут на КОЖЕН HTTP-запит (і кожну retry-спробу) */
const REQUEST_TIMEOUT_MS = 30_000;

let supabaseClient: SupabaseClient<Database> | null = null;

/** Лінива ініціалізація клієнта (REST-only, без сесій авторизації) */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();
    supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { timeout: REQUEST_TIMEOUT_MS },
    });
  }
  return supabaseClient;
}
