import got from 'got';
import type { Database } from '../../lib/database.types';
import { getSupabaseCredentials } from './supabase-credentials';

type BannerCampaignRow = Database['public']['Tables']['banner_campaigns']['Row'];

/**
 * Дані банера, які повертає edge function `get-banners`.
 * Всі типи уніфіковані: image_path + link.
 * Пріоритет визначається на бекенді — повертається один найкращий банер.
 */
export type BannerData = Pick<BannerCampaignRow, 'id' | 'type' | 'image_path' | 'link'>;

/** Відповідь edge function get-banners */
interface GetBannersResponse {
  success: boolean;
  /** Один банер з найвищим пріоритетом, або null */
  banner: BannerData | null;
  /** Чи гра імпортована з Kuli (тільки для game_page запитів) */
  is_kuli?: boolean;
  error?: string;
}

/** Результат запиту банерів для гри */
export interface GameBannersResult {
  /** Один банер з найвищим пріоритетом, або null */
  banner: BannerData | null;
  /** Чи гра імпортована з Kuli */
  isKuli: boolean;
}

type BannerImpressionInsert =
  Database['public']['Tables']['banner_impressions']['Insert'];
export type ImpressionType = 'view' | 'click';

// ---------------------------------------------------------------------------
// Fetch banners
// ---------------------------------------------------------------------------

/**
 * Отримати активні банери для гри з edge function `get-banners`.
 *
 * Edge function виконує:
 * 1. Фільтрує кампанії по is_active, placement, start_date, end_date
 * 2. Для game_page — фільтрує по таргетуванню (target_all_games, target_game_slugs)
 * 3. Застосовує frequency capping (якщо передано machine_id)
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
 *   // Картинка: buildBannerImageUrl(SUPABASE_URL, banner.image_path)
 *   // Клік -> відкрити banner.link
 *   // Розмір: narrow=970x90, small_square=300x250
 *
 *   await recordBannerImpression({
 *     campaignId: banner.id,
 *     impressionType: 'view',
 *     gameSlug: 'the-witcher-3',
 *   });
 * }
 *
 * // isKuli — чи гра імпортована з Kuli
 * ```
 */
export async function fetchBannersForGame(params: {
  gameSlug: string;
  gameId: string;
  /** Machine ID для frequency capping. Отримати через getMachineId() з tracking.ts */
  machineId?: string;
}): Promise<GameBannersResult> {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

    const searchParams = new URLSearchParams({
      game_slug: params.gameSlug,
      game_id: params.gameId,
    });

    if (params.machineId) {
      searchParams.set('machine_id', params.machineId);
    }

    const url = `${SUPABASE_URL}/functions/v1/get-banners?${searchParams.toString()}`;

    const response = await got<GetBannersResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      responseType: 'json',
      timeout: {
        connect: 5000,
        response: 10_000,
      },
    });

    if (response.body.success) {
      console.log(
        `[banners-api] Fetched banner=${response.body.banner?.id ?? 'none'} for game=${params.gameSlug}, kuli=${response.body.is_kuli}`
      );
      return {
        banner: response.body.banner,
        isKuli: response.body.is_kuli ?? false,
      };
    }

    console.warn('[banners-api] Failed to fetch banners:', response.body.error);
    return { banner: null, isKuli: false };
  } catch (error) {
    console.error('[banners-api] Error fetching banners:', error);
    return { banner: null, isKuli: false };
  }
}

/**
 * Отримати глобальний банер (не привʼязаний до конкретної гри).
 * Типи: wide (800x400), large_popup (800x600).
 * Повертає один банер з найвищим пріоритетом, або null.
 */
export async function fetchGlobalBanner(params?: {
  machineId?: string;
}): Promise<BannerData | null> {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

    const searchParams = new URLSearchParams({ placement: 'global' });

    if (params?.machineId) {
      searchParams.set('machine_id', params.machineId);
    }

    const url = `${SUPABASE_URL}/functions/v1/get-banners?${searchParams.toString()}`;

    const response = await got<GetBannersResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      responseType: 'json',
      timeout: {
        connect: 5000,
        response: 10_000,
      },
    });

    if (response.body.success) {
      console.log(
        `[banners-api] Fetched global banner=${response.body.banner?.id ?? 'none'}`
      );
      return response.body.banner;
    }

    console.warn('[banners-api] Failed to fetch global banner:', response.body.error);
    return null;
  } catch (error) {
    console.error('[banners-api] Error fetching global banner:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Record impressions (views & clicks)
// ---------------------------------------------------------------------------

/**
 * Записати показ або клік банера в таблицю `banner_impressions`.
 *
 * Викликати:
 * - `impression_type: 'view'` — коли банер відобразився на екрані
 * - `impression_type: 'click'` — коли користувач клікнув на банер
 *
 * Дані записуються напряму в Supabase через REST API (не через edge function).
 * RLS дозволяє INSERT для anon ролі.
 *
 * Таблиця `banner_impressions`:
 * | Поле             | Тип    | Обовʼязкове | Опис                              |
 * |------------------|--------|-------------|-----------------------------------|
 * | campaign_id      | uuid   | так         | ID кампанії (з BannerData.id)     |
 * | impression_type  | text   | так         | 'view' або 'click'                |
 * | machine_id       | text   | ні          | Для frequency capping і аналітики |
 * | game_slug        | text   | ні          | Slug гри де показано банер        |
 *
 * @example
 * ```ts
 * // При показі банера
 * await recordBannerImpression({
 *   campaignId: banner.id,
 *   impressionType: 'view',
 *   gameSlug: 'the-witcher-3',
 * });
 *
 * // При кліку на банер
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
  /** Machine ID для аналітики. Отримати через getMachineId() з tracking.ts */
  machineId?: string | null;
  /** Slug гри на сторінці якої показано банер */
  gameSlug?: string | null;
}): Promise<boolean> {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

    const body: BannerImpressionInsert = {
      campaign_id: params.campaignId,
      impression_type: params.impressionType,
      machine_id: params.machineId ?? null,
      game_slug: params.gameSlug ?? null,
    };

    const response = await got(`${SUPABASE_URL}/rest/v1/banner_impressions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      json: body,
      timeout: {
        connect: 5000,
        response: 10_000,
      },
    });

    if (response.statusCode === 201) {
      console.log(
        `[banners-api] Recorded ${params.impressionType} for campaign=${params.campaignId}`
      );
      return true;
    }

    console.warn(`[banners-api] Failed to record impression: ${response.statusCode}`);
    return false;
  } catch (error) {
    console.error('[banners-api] Error recording impression:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Побудувати повний URL зображення з відносного шляху в Storage.
 *
 * @example
 * ```ts
 * const { SUPABASE_URL } = getSupabaseCredentials();
 * const imgUrl = buildBannerImageUrl(banner.image_path);
 * // https://xxx.supabase.co/storage/v1/object/public/banner-images/banners/promo.webp
 * ```
 */
export function buildBannerImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { SUPABASE_URL } = getSupabaseCredentials();

  return `${SUPABASE_URL}/storage/v1/object/public/banner-images/${path}`;
}
