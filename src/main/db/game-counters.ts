import { z } from 'zod';
import type { Database } from '../../lib/database.types';
import { likesWithUnsentSql } from '../likes';
import { notifyCountersUpdated } from './counters-updated';
import { getDatabase } from './database';
import { createDeltaStream } from './delta-stream';
import { GamesRepository } from './games-repository';
import { getSupabaseClient } from './supabase-client';
import { keysetPages, latest } from './sync-cursor';

interface GameCounters {
  id: string;
  likes: number;
  downloads: number | null;
  subscriptions: number | null;
  reviews: number;
  error_reviews: number;
  downloads_30d: number;
}

const PAGE_SIZE = 1000;

type CounterRow = Database['public']['Functions']['get_game_counters']['Returns'][number];

// A counter the server adds later rides at the end, so a shipped launcher keeps reading the ones it knows
const broadcastSchema = z.object({
  counters: z.array(
    z
      .tuple([
        z.string(),
        z.number(),
        z.number().nullable(),
        z.number().nullable(),
        z.number(),
        z.number(),
        z.number(),
      ])
      .rest(z.unknown())
  ),
});

function applyGameCounters(rows: GameCounters[]): void {
  const db = getDatabase();
  const likes = likesWithUnsentSql('@likes', '@id');
  const update = db.prepare(`
    UPDATE games
    SET likes = ${likes}, downloads = @downloads, subscriptions = @subscriptions,
      reviews = @reviews, error_reviews = @error_reviews, downloads_30d = @downloads_30d
    WHERE id = @id
      AND (likes IS NOT ${likes} OR downloads IS NOT @downloads
        OR subscriptions IS NOT @subscriptions OR reviews IS NOT @reviews
        OR error_reviews IS NOT @error_reviews OR downloads_30d IS NOT @downloads_30d)
  `);
  const changed = db.transaction((batch: GameCounters[]) =>
    batch.filter((row) => update.run(row).changes > 0).map((row) => row.id)
  )(rows);

  if (changed.length > 0) {
    notifyCountersUpdated(GamesRepository.getInstance().getGamesByIds(changed));
  }
}

const counters = createDeltaStream({
  name: 'GameCounters',
  watermarkKey: 'game_counters_synced_at',
  async *fetchSince(since) {
    const supabase = getSupabaseClient();
    const pages = keysetPages(
      async (last: CounterRow | undefined) => {
        const query = supabase.rpc('get_game_counters', { p_since: since ?? undefined });
        const { data, error } = await (last ? query.gt('game_id', last.game_id) : query)
          .order('game_id', { ascending: true })
          .limit(PAGE_SIZE);
        if (error) {
          throw error;
        }
        return data;
      },
      (page) => page.length < PAGE_SIZE
    );
    const touched: string[] = [];
    for await (const page of pages) {
      touched.push(...page.flatMap((row) => (row.touched_at ? [row.touched_at] : [])));
      yield {
        items: page.map((row) => ({
          id: row.game_id,
          likes: row.likes,
          downloads: row.downloads,
          subscriptions: row.subscriptions,
          reviews: row.reviews,
          error_reviews: row.error_reviews,
          downloads_30d: row.downloads_30d,
        })),
      };
    }
    // Pages come ordered by id, not touched_at, so the watermark is saved only once all of them are applied
    yield { items: [], watermark: latest(since, touched) ?? undefined };
  },
  apply: applyGameCounters,
  realtime: () => ({
    topic: 'game-counters',
    private: true,
    event: 'counters',
    schema: broadcastSchema,
    toItems: ({ counters: rows }) =>
      rows.map(
        ([
          id,
          likes,
          downloads,
          subscriptions,
          reviews,
          error_reviews,
          downloads_30d,
        ]) => ({
          id,
          likes,
          downloads,
          subscriptions,
          reviews,
          error_reviews,
          downloads_30d,
        })
      ),
  }),
});

export const syncGameCounters = counters.catchUp;
export const createGameCountersSubscription = counters.subscription;
