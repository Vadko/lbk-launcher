import { A, O } from '@mobily/ts-belt';
import { z } from 'zod';
import type { WeeklyPicks } from '../../shared/weekly-picks-types';
import { sendToRenderer } from '../window';
import { getDatabase } from './database';
import { createDeltaStream } from './delta-stream';
import { GamesRepository } from './games-repository';
import { getSupabaseClient } from './supabase-client';

interface PickSet {
  title: string | null;
  startsAt: number;
  gameIds: string[];
}

const setSchema = z.object({
  title: z.string().nullable(),
  starts_at: z.string(),
  game_ids: z.array(z.string()),
});

const toPickSet = (row: z.infer<typeof setSchema>): PickSet => ({
  title: row.title,
  startsAt: Date.parse(row.starts_at),
  gameIds: row.game_ids,
});

// get_home_picks and the broadcast both carry the one current set
function applyWeeklyPicks([set]: PickSet[]): void {
  // An older set never replaces a newer one: a catch-up that started before a broadcast can answer after it
  const { changes } = getDatabase()
    .prepare(`
      INSERT INTO weekly_picks (id, title, starts_at, game_ids)
      VALUES (1, @title, @startsAt, @gameIds)
      ON CONFLICT(id) DO UPDATE
      SET title = excluded.title, starts_at = excluded.starts_at, game_ids = excluded.game_ids
      WHERE excluded.starts_at >= weekly_picks.starts_at
        AND (title IS NOT excluded.title OR starts_at IS NOT excluded.starts_at
          OR game_ids IS NOT excluded.game_ids)
    `)
    .run({ ...set, gameIds: JSON.stringify(set.gameIds) });

  if (changes > 0) {
    sendToRenderer('weekly-picks-updated');
  }
}

const weeklyPicks = createDeltaStream({
  name: 'WeeklyPicks',
  watermarkKey: 'weekly_picks_synced_at',
  // The current set is the whole state, so every catch-up reads it again whatever the watermark
  async *fetchSince() {
    const { data, error } = await getSupabaseClient().rpc('get_home_picks');
    if (error) {
      throw error;
    }
    yield { items: data.map(toPickSet) };
  },
  apply: applyWeeklyPicks,
  realtime: () => ({
    topic: 'home-picks',
    private: true,
    event: 'set',
    schema: setSchema,
    toItems: (row) => [toPickSet(row)],
  }),
});

export const syncWeeklyPicks = weeklyPicks.catchUp;
export const createWeeklyPicksSubscription = weeklyPicks.subscription;

export function getWeeklyPicks(hideAiTranslations: boolean): WeeklyPicks | null {
  const db = getDatabase();
  const set = db
    .prepare<[], { title: string | null }>('SELECT title FROM weekly_picks WHERE id = 1')
    .get();
  if (!set) {
    return null;
  }

  const gameIds = db
    .prepare<[], { id: string }>(
      'SELECT value AS id FROM weekly_picks, json_each(weekly_picks.game_ids) ORDER BY json_each.key'
    )
    .all()
    .map((row) => row.id);
  const byId = new Map(
    GamesRepository.getInstance()
      .getGamesByIds(gameIds, undefined, hideAiTranslations)
      .map((game) => [game.id, game])
  );
  return {
    title: set.title,
    games: A.filterMap(gameIds, (id) => O.fromNullable(byId.get(id))),
  };
}
