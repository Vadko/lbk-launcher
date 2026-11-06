import type { WeeklyPicksResult } from '../../shared/weekly-picks-types';
import { getSupabaseClient } from './supabase-client';

export async function fetchWeeklyPicks(): Promise<WeeklyPicksResult> {
  const { data, error } = await getSupabaseClient().rpc('get_home_picks');

  if (error) {
    console.warn('[WeeklyPicks] Failed to fetch the current set:', error.message);
    return { success: false, error: error.message };
  }

  const row = data?.[0];
  return {
    success: true,
    picks: row ? { title: row.title, gameIds: row.game_ids } : null,
  };
}
