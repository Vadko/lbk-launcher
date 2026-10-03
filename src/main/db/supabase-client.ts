import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import { getSupabaseCredentials } from './supabase-credentials';

/**
 * Shared typed supabase-js client for the main process (REST fetches).
 *
 * supabase-js (postgrest-js) has built-in retry and timeout:
 * - retry: up to 3 attempts with exponential backoff on network errors and
 *   503/520 statuses (idempotent GET/HEAD/OPTIONS only);
 * - timeout: the db.timeout option — postgrest wraps fetch in an AbortController
 *   per-attempt and clears the timer.
 *
 * Edge Functions (functions.invoke) are not covered by db.timeout, but rely
 * on Node-fetch (undici) defaults: ~10s to connect, ~300s for a response — good
 * enough for background calls.
 */

/** Timeout for EVERY PostgREST request (and every retry attempt) */
const REQUEST_TIMEOUT_MS = 30_000;

let supabaseClient: SupabaseClient<Database> | null = null;

/** Lazy client initialization (REST-only, no auth sessions) */
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
