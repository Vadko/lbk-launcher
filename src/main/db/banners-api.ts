import type { Database } from '../../lib/database.types';
import { getSupabaseClient } from './supabase-client';

type BannerCampaignRow = Database['public']['Tables']['banner_campaigns']['Row'];

/**
 * Banner data returned by the `get-banners` edge function.
 * All types are unified: image_path + link.
 * Priority is determined on the backend — a single best banner is returned.
 */
export type BannerData = Pick<BannerCampaignRow, 'id' | 'type' | 'image_path' | 'link'>;

/** Response of the get-banners edge function */
interface GetBannersResponse {
  success: boolean;
  /** A single banner with the highest priority, or null */
  banner: BannerData | null;
  /** Whether the game was imported from Kuli (game_page requests only) */
  is_kuli?: boolean;
  error?: string;
}

/** Result of a banner request for a game */
export interface GameBannersResult {
  /** A single banner with the highest priority, or null */
  banner: BannerData | null;
  /** Whether the game was imported from Kuli */
  isKuli: boolean;
}

type BannerImpressionInsert =
  Database['public']['Tables']['banner_impressions']['Insert'];
export type ImpressionType = 'view' | 'click';

// ---------------------------------------------------------------------------
// Fetch banners
// ---------------------------------------------------------------------------

/**
 * Fetch active banners for a game from the `get-banners` edge function.
 *
 * The edge function:
 * 1. Filters campaigns by is_active, placement, start_date, end_date
 * 2. For game_page — filters by targeting (target_all_games, target_game_slugs)
 * 3. Applies frequency capping (when machine_id is passed)
 *
 * @example
 * ```ts
 * import { getMachineId } from '../tracking';
 *
 * const { banner, isKuli } = await fetchBannersForGame({
 *   gameSlug: 'the-witcher-3',
 *   gameId: 'abc-123-def',
 *   machineId: getMachineId() ?? undefined,
 * });
 *
 * if (banner) {
 *   // Image: buildBannerImageUrl(SUPABASE_URL, banner.image_path)
 *   // Click -> open banner.link
 *   // Size: narrow=970x90, small_square=300x250
 *
 *   await recordBannerImpression({
 *     campaignId: banner.id,
 *     impressionType: 'view',
 *     gameSlug: 'the-witcher-3',
 *   });
 * }
 *
 * // isKuli — whether the game was imported from Kuli
 * ```
 */
export async function fetchBannersForGame(params: {
  gameSlug: string;
  gameId: string;
  /** Machine ID for frequency capping. Get it via getMachineId() from tracking.ts */
  machineId?: string;
}): Promise<GameBannersResult> {
  try {
    const supabase = getSupabaseClient();

    const searchParams = new URLSearchParams({
      game_slug: params.gameSlug,
      game_id: params.gameId,
    });

    if (params.machineId) {
      searchParams.set('machine_id', params.machineId);
    }

    const { data, error } = await supabase.functions.invoke<GetBannersResponse>(
      `get-banners?${searchParams.toString()}`,
      { method: 'GET' }
    );

    if (error || !data?.success) {
      console.warn('[banners-api] Failed to fetch banners:', error ?? data?.error);
      return { banner: null, isKuli: false };
    }

    console.log(
      `[banners-api] Fetched banner=${data.banner?.id ?? 'none'} for game=${params.gameSlug}, kuli=${data.is_kuli}`
    );
    return {
      banner: data.banner,
      isKuli: data.is_kuli ?? false,
    };
  } catch (error) {
    console.error('[banners-api] Error fetching banners:', error);
    return { banner: null, isKuli: false };
  }
}

/**
 * Fetch a global banner (not tied to a specific game).
 * Types: wide (800x400), large_popup (800x600).
 * Returns a single banner with the highest priority, or null.
 */
export async function fetchGlobalBanner(params?: {
  machineId?: string;
}): Promise<BannerData | null> {
  try {
    const supabase = getSupabaseClient();

    const searchParams = new URLSearchParams({ placement: 'global' });

    if (params?.machineId) {
      searchParams.set('machine_id', params.machineId);
    }

    const { data, error } = await supabase.functions.invoke<GetBannersResponse>(
      `get-banners?${searchParams.toString()}`,
      { method: 'GET' }
    );

    if (error || !data?.success) {
      console.warn('[banners-api] Failed to fetch global banner:', error ?? data?.error);
      return null;
    }

    console.log(`[banners-api] Fetched global banner=${data.banner?.id ?? 'none'}`);
    return data.banner;
  } catch (error) {
    console.error('[banners-api] Error fetching global banner:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Record impressions (views & clicks)
// ---------------------------------------------------------------------------

/**
 * Record a banner view or click into the `banner_impressions` table.
 *
 * Call with:
 * - `impression_type: 'view'` — when the banner was displayed on screen
 * - `impression_type: 'click'` — when the user clicked the banner
 *
 * Data is written directly to Supabase via the REST API (not through an edge function).
 * RLS allows INSERT for the anon role.
 *
 * `banner_impressions` table:
 * | Field            | Type   | Required    | Description                       |
 * |------------------|--------|-------------|-----------------------------------|
 * | campaign_id      | uuid   | yes         | Campaign ID (from BannerData.id)  |
 * | impression_type  | text   | yes         | 'view' or 'click'                 |
 * | machine_id       | text   | no          | For frequency capping and analytics |
 * | game_slug        | text   | no          | Slug of the game the banner was shown on |
 *
 * @example
 * ```ts
 * // On banner display
 * await recordBannerImpression({
 *   campaignId: banner.id,
 *   impressionType: 'view',
 *   gameSlug: 'the-witcher-3',
 * });
 *
 * // On banner click
 * await recordBannerImpression({
 *   campaignId: banner.id,
 *   impressionType: 'click',
 *   gameSlug: 'the-witcher-3',
 * });
 * ```
 */
export async function recordBannerImpression(params: {
  campaignId: string;
  impressionType: ImpressionType;
  /** Machine ID for analytics. Get it via getMachineId() from tracking.ts */
  machineId?: string | null;
  /** Slug of the game on whose page the banner was shown */
  gameSlug?: string | null;
}): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const body: BannerImpressionInsert = {
      campaign_id: params.campaignId,
      impression_type: params.impressionType,
      machine_id: params.machineId ?? null,
      game_slug: params.gameSlug ?? null,
    };

    const { error } = await supabase.from('banner_impressions').insert(body);

    if (error) {
      console.warn(`[banners-api] Failed to record impression: ${error.message}`);
      return false;
    }

    console.log(
      `[banners-api] Recorded ${params.impressionType} for campaign=${params.campaignId}`
    );
    return true;
  } catch (error) {
    console.error('[banners-api] Error recording impression:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a full image URL from a relative Storage path.
 *
 * @example
 * ```ts
 * const imgUrl = buildBannerImageUrl(banner.image_path);
 * // https://xxx.supabase.co/storage/v1/object/public/banner-images/banners/promo.webp
 * ```
 */
export function buildBannerImageUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  return getSupabaseClient().storage.from('banner-images').getPublicUrl(path).data
    .publicUrl;
}
