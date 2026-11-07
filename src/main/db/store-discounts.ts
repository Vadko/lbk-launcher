import { z } from 'zod';
import type { Database } from '../../lib/database.types';
import type { DiscountStore, StoreDiscount } from '../../shared/types';
import { sendToRenderer } from '../window';
import { getDatabase } from './database';
import { createDeltaStream } from './delta-stream';
import { getSupabaseClient } from './supabase-client';
import { afterCursor, keysetPages, latest } from './sync-cursor';

const PAGE_SIZE = 1000;

const storeSchema = z.enum(['steam', 'gog', 'egs']) satisfies z.ZodType<DiscountStore>;

// postgres-meta never marks RETURNS TABLE columns nullable, but an ended or GOG row has no end
type FeedRow = Omit<
  Database['public']['Functions']['get_store_discounts']['Returns'][number],
  'ends_at'
> & { ends_at: string | null };

const broadcastSchema = z.object({
  discounts: z.array(
    z.tuple([z.string(), z.number(), z.number(), z.number().nullable()], z.unknown())
  ),
});

type Discount = Omit<StoreDiscount, 'store'> & { store: string };

// A store this build does not know yet is left out instead of failing the batch
const withKnownStores = (rows: Discount[]): StoreDiscount[] =>
  rows.flatMap((row) => {
    const store = storeSchema.safeParse(row.store).data;
    return store ? [{ ...row, store }] : [];
  });

const discountKey = ({ store, steamAppId }: StoreDiscount) => `${store}:${steamAppId}`;

// Keys a broadcast wrote during the running catch-up, whose pages may have been read before it
const catchUp: { broadcastKeys?: Set<string> } = {};

async function* guardingBroadcasts<T>(batches: AsyncIterable<T>): AsyncGenerator<T> {
  catchUp.broadcastKeys = new Set();
  try {
    yield* batches;
  } finally {
    catchUp.broadcastKeys = undefined;
  }
}

function applyStoreDiscounts(items: StoreDiscount[], live: boolean): void {
  const keys = catchUp.broadcastKeys;
  if (live) {
    items.forEach((row) => keys?.add(discountKey(row)));
  }
  const rows = live || !keys ? items : items.filter((row) => !keys.has(discountKey(row)));
  const db = getDatabase();
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO store_discounts (store, steam_app_id, discount_percent, ends_at)
    VALUES (@store, @steamAppId, @percent, @endsAt)
    ON CONFLICT(store, steam_app_id) DO UPDATE
    SET discount_percent = excluded.discount_percent, ends_at = excluded.ends_at
    WHERE discount_percent IS NOT excluded.discount_percent
      OR ends_at IS NOT excluded.ends_at
  `);
  const remove = db.prepare(
    'DELETE FROM store_discounts WHERE store = ? AND steam_app_id = ?'
  );
  const changed = db.transaction((batch: StoreDiscount[]) =>
    batch.filter(
      ({ store, steamAppId, percent, endsAt }) =>
        (percent > 0 && (endsAt === null || endsAt > now)
          ? upsert.run({ store, steamAppId, percent, endsAt })
          : remove.run(store, steamAppId)
        ).changes > 0
    )
  )(rows);

  if (changed.length > 0) {
    sendToRenderer('store-discounts-updated');
  }
}

const toDiscount = (row: FeedRow): Discount => ({
  store: row.store,
  steamAppId: row.steam_app_id,
  percent: row.discount_percent,
  endsAt: row.ends_at === null ? null : Date.parse(row.ends_at),
});

// Pages come ordered by store and app id, not touched_at, so the watermark is saved only once all of them are applied
async function* withFinalWatermark(
  pages: AsyncIterator<FeedRow[]>,
  watermark: string | null
): AsyncGenerator<{ items: StoreDiscount[]; watermark?: string }> {
  const next = await pages.next();
  if (next.done) {
    yield { items: [], watermark: watermark ?? undefined };
    return;
  }
  yield { items: withKnownStores(next.value.map(toDiscount)) };
  yield* withFinalWatermark(
    pages,
    latest(
      watermark,
      next.value.map((row) => row.touched_at)
    )
  );
}

const discounts = createDeltaStream({
  name: 'StoreDiscounts',
  watermarkKey: 'store_discounts_synced_at',
  fetchSince(since) {
    const supabase = getSupabaseClient();
    const pages = keysetPages(
      async (last: FeedRow | undefined): Promise<FeedRow[]> => {
        const query = supabase.rpc('get_store_discounts', {
          p_since: since ?? undefined,
        });
        const { data, error } = await (last
          ? query.or(afterCursor('store', last.store, 'steam_app_id', last.steam_app_id))
          : query
        )
          .order('store', { ascending: true })
          .order('steam_app_id', { ascending: true })
          .limit(PAGE_SIZE);
        if (error) {
          throw error;
        }
        return data;
      },
      (page) => page.length < PAGE_SIZE
    );
    return guardingBroadcasts(withFinalWatermark(pages, since));
  },
  apply: applyStoreDiscounts,
  realtime: () => ({
    topic: 'store-discounts',
    private: true,
    event: 'discounts',
    schema: broadcastSchema,
    toItems: ({ discounts: rows }) =>
      withKnownStores(
        rows.map(([store, steamAppId, percent, endsAt]) => ({
          store,
          steamAppId,
          percent,
          endsAt: endsAt === null ? null : endsAt * 1000,
        }))
      ),
  }),
});

export const syncStoreDiscounts = discounts.catchUp;
export const createStoreDiscountsSubscription = discounts.subscription;

export function getActiveStoreDiscounts(): StoreDiscount[] {
  return getDatabase()
    .prepare<[number], StoreDiscount>(
      `SELECT store, steam_app_id AS steamAppId, discount_percent AS percent, ends_at AS endsAt
      FROM store_discounts WHERE ends_at IS NULL OR ends_at > ?`
    )
    .all(Date.now());
}
