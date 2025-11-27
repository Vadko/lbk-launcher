import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Get Supabase credentials from environment variables
// electron-vite automatically loads .env files
// Variables with VITE_ prefix are available in renderer process via import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Electron не потребує сесій
    autoRefreshToken: false,
  },
});
