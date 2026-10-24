/**
 * Central module for obtaining Supabase credentials
 * Used in the main process
 */

interface SupabaseCredentials {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

/**
 * Get the Supabase credentials from environment variables
 * @throws Error when the credentials are missing
 */
export function getSupabaseCredentials(): SupabaseCredentials {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}
