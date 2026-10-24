import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { getSupabaseClient } from './supabase-client';

export async function fetchWeeklyPicks(): Promise<WeeklyPicks | null> {
  const { data, error } = await getSupabaseClient().rpc('get_home_picks');

  if (error) {
    console.warn('[WeeklyPicks] Failed to fetch the current set:', error.message);
    return null;
  }

  const row = data?.[0];
  if (!row || row.game_ids.length === 0) {
    return null;
  }

  return {
    title: row.title,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    gameIds: row.game_ids,
  };
}
