import { z } from 'zod';
import type { Database } from '../../lib/database.types';
import type { SteamDiscount } from '../../shared/types';
import { sendToRenderer } from '../window';
import { getDatabase } from './database';
import { createDeltaStream } from './delta-stream';
import { getSupabaseClient } from './supabase-client';
import { keysetPages, latest } from './sync-cursor';

interface DiscountUpdate {
  steamAppId: number;
  percent: number;
  endsAt: number | null;
}

const PAGE_SIZE = 1000;

// postgres-meta never marks RETURNS TABLE columns nullable, but an ended row has no end
type FeedRow = Omit<
  Database['public']['Functions']['get_steam_discounts']['Returns'][number],
  'ends_at'
> & { ends_at: string | null };

const broadcastSchema = z.object({
  discounts: z.array(
    z.tuple([z.number(), z.number(), z.number().nullable()], z.unknown())
  ),
});

function applySteamDiscounts(rows: DiscountUpdate[]): void {
  const db = getDatabase();
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO steam_discounts (steam_app_id, discount_percent, ends_at)
    VALUES (@steamAppId, @percent, @endsAt)
    ON CONFLICT(steam_app_id) DO UPDATE
    SET discount_percent = excluded.discount_percent, ends_at = excluded.ends_at
    WHERE discount_percent IS NOT excluded.discount_percent
      OR ends_at IS NOT excluded.ends_at
  `);
  const remove = db.prepare('DELETE FROM steam_discounts WHERE steam_app_id = ?');
  const changed = db.transaction((batch: DiscountUpdate[]) =>
    batch.filter(
      ({ steamAppId, percent, endsAt }) =>
        (percent > 0 && endsAt !== null && endsAt > now
          ? upsert.run({ steamAppId, percent, endsAt })
          : remove.run(steamAppId)
        ).changes > 0
    )
  )(rows);

  if (changed.length > 0) {
    sendToRenderer('steam-discounts-updated');
  }
}

const toUpdate = (row: FeedRow): DiscountUpdate => ({
  steamAppId: row.steam_app_id,
  percent: row.discount_percent,
  endsAt: row.ends_at === null ? null : Date.parse(row.ends_at),
});

// Pages come ordered by app id, not touched_at, so the watermark is saved only once all of them are applied
async function* withFinalWatermark(
  pages: AsyncIterator<FeedRow[]>,
  watermark: string | null
): AsyncGenerator<{ items: DiscountUpdate[]; watermark?: string }> {
  const next = await pages.next();
  if (next.done) {
    yield { items: [], watermark: watermark ?? undefined };
    return;
  }
  yield { items: next.value.map(toUpdate) };
  yield* withFinalWatermark(
    pages,
    latest(
      watermark,
      next.value.map((row) => row.touched_at)
    )
  );
}

const discounts = createDeltaStream({
  name: 'SteamDiscounts',
  watermarkKey: 'steam_discounts_synced_at',
  fetchSince(since) {
    const supabase = getSupabaseClient();
    const pages = keysetPages(
      async (last: FeedRow | undefined): Promise<FeedRow[]> => {
        const query = supabase.rpc('get_steam_discounts', {
          p_since: since ?? undefined,
        });
        const { data, error } = await (last
          ? query.gt('steam_app_id', last.steam_app_id)
          : query
        )
          .order('steam_app_id', { ascending: true })
          .limit(PAGE_SIZE);
        if (error) {
          throw error;
        }
        return data;
      },
      (page) => page.length < PAGE_SIZE
    );
    return withFinalWatermark(pages, since);
  },
  apply: applySteamDiscounts,
  realtime: () => ({
    topic: 'steam-discounts',
    event: 'discounts',
    schema: broadcastSchema,
    toItems: ({ discounts: rows }) =>
      rows.map(([steamAppId, percent, endsAt]) => ({
        steamAppId,
        percent,
        endsAt: endsAt === null ? null : endsAt * 1000,
      })),
  }),
});

export const syncSteamDiscounts = discounts.catchUp;
export const createSteamDiscountsSubscription = discounts.subscription;

export function getActiveSteamDiscounts(): SteamDiscount[] {
  return getDatabase()
    .prepare<[number], SteamDiscount>(
      `SELECT steam_app_id AS steamAppId, discount_percent AS percent, ends_at AS endsAt
      FROM steam_discounts WHERE ends_at > ?`
    )
    .all(Date.now());
}
