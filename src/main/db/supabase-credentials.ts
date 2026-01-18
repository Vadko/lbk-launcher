/**
 * Централізований модуль для отримання Supabase credentials
 * Використовується в main process
 */

export interface SupabaseCredentials {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

/**
 * Отримати Supabase credentials з environment variables
 * @throws Error якщо credentials відсутні
 */
export function getSupabaseCredentials(): SupabaseCredentials {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  return { SUPABASE_URL, SUPABASE_ANON_KEY };
}
