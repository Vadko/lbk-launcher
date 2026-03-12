import got from 'got';
import type { Database } from '../../lib/database.types';
import { getSupabaseCredentials } from './supabase-credentials';

/**
 * ============================================================================
 * BANNER CAMPAIGNS API
 * ============================================================================
 *
 * Модуль для роботи з рекламними банерами. Викликається ТІЛЬКИ в main process.
 *
 * ## Архітектура
 *
 * 1. Адмін створює кампанію через адмін-панель (lbk-admin /admin/banners)
 * 2. Зображення зберігаються в Supabase Storage (бакет `banner-images`)
 * 3. Лаунчер запитує банери через edge function `get-banners`
 * 4. Лаунчер записує покази/кліки через `recordBannerImpression()`
 *
 * ## Типи банерів
 *
 * - `narrow` (970x90) — горизонтальний банер з іконкою, заголовком, підзаголовком і кнопкою
 *   Поля: icon_path, title, subtitle, button_text, link (розрахований з link_template)
 *   link_template підтримує `{game_slug}` — edge function підставляє автоматично
 *
 * - `small_square` (300x250) — квадратний банер-картинка з посиланням
 *   Поля: image_path, link
 *
 * - `large_popup` (800x600) — великий pop-up банер з посиланням
 *   Поля: image_path, link
 *
 * ## Типи з database.types.ts
 *
 * Автогенеровані типи доступні з `../../lib/database.types`:
 *
 * ```ts
 * import type { Database } from '../../lib/database.types';
 *
 * // Enums
 * type BannerType = Database['public']['Enums']['banner_type'];
 *   // 'narrow' | 'small_square' | 'large_popup'
 *
 * type BannerPlacement = Database['public']['Enums']['banner_placement'];
 *   // 'game_page' | 'global'
 *
 * // Повний рядок з таблиці banner_campaigns
 * type BannerCampaignRow = Database['public']['Tables']['banner_campaigns']['Row'];
 *
 * // Для запису імпрешенів
 * type BannerImpressionInsert = Database['public']['Tables']['banner_impressions']['Insert'];
 *   // { campaign_id: string, impression_type: string, machine_id?: string, game_slug?: string }
 * ```
 *
 * ## URL зображень
 *
 * Шляхи (icon_path, image_path) — відносні в бакеті `banner-images`.
 * Повний URL: `${SUPABASE_URL}/storage/v1/object/public/banner-images/${path}`
 *
 * ## Frequency capping
 *
 * Edge function автоматично фільтрує кампанії з frequency_cap якщо передати machine_id.
 * Наприклад, frequency_cap=3 — максимум 3 покази на день для одного machine_id.
 * Без machine_id — frequency capping не працює.
 */

// ---------------------------------------------------------------------------
// Types (derived from database.types.ts)
// ---------------------------------------------------------------------------

type BannerCampaignRow = Database['public']['Tables']['banner_campaigns']['Row'];

export type BannerType = Database['public']['Enums']['banner_type'];
export type BannerPlacement = Database['public']['Enums']['banner_placement'];

/**
 * Дані банера, які повертає edge function `get-banners`.
 *
 * Залежно від типу банера, присутні різні поля:
 * - narrow:       icon_path, title, subtitle, button_text, link
 * - small_square: image_path, link
 * - large_popup:  image_path, link
 *
 * Поля завжди присутні: id, type, priority.
 * Решта — optional, залежать від типу банера.
 */
export type BannerData = Pick<BannerCampaignRow, 'id' | 'type' | 'priority'> &
  Partial<Pick<BannerCampaignRow, 'icon_path' | 'title' | 'subtitle' | 'button_text' | 'link' | 'image_path'>>;

/** Відповідь edge function get-banners */
interface GetBannersResponse {
  success: boolean;
  banners: BannerData[];
  error?: string;
}

export type BannerImpressionInsert = Database['public']['Tables']['banner_impressions']['Insert'];

/** Тип імпрешену: 'view' = показ, 'click' = клік */
export type ImpressionType = 'view' | 'click';

// ---------------------------------------------------------------------------
// Fetch banners
// ---------------------------------------------------------------------------

/**
 * Отримати активні банери для гри з edge function `get-banners`.
 *
 * Edge function виконує:
 * 1. Фільтрує кампанії по is_active, placement, start_date, end_date
 * 2. Фільтрує по таргетуванню (target_all_games, target_game_slugs, target_source)
 * 3. Перевіряє чи гра — з Kuli (для target_source='kuli')
 * 4. Застосовує frequency capping (якщо передано machine_id)
 * 5. Для narrow типу — підставляє game_slug в link_template
 *
 * @example
 * ```ts
 * import { getMachineId } from '../tracking';
 *
 * const banners = await fetchBannersForGame({
 *   gameSlug: 'the-witcher-3',
 *   gameId: 'abc-123-def',
 *   machineId: getMachineId() ?? undefined,
 * });
 *
 * for (const banner of banners) {
 *   if (banner.type === 'narrow') {
 *     // Показати горизонтальний банер:
 *     // - Іконка: `${storageUrl}/banner-images/${banner.icon_path}`
 *     // - Заголовок: banner.title
 *     // - Підзаголовок: banner.subtitle
 *     // - Кнопка: banner.button_text -> відкрити banner.link
 *   } else {
 *     // small_square або large_popup:
 *     // - Картинка: `${storageUrl}/banner-images/${banner.image_path}`
 *     // - Клік -> відкрити banner.link
 *   }
 *
 *   // Записати показ
 *   await recordBannerImpression({
 *     campaignId: banner.id,
 *     impressionType: 'view',
 *     gameSlug: 'the-witcher-3',
 *   });
 * }
 * ```
 */
export async function fetchBannersForGame(params: {
  gameSlug: string;
  gameId: string;
  /** Machine ID для frequency capping. Отримати через getMachineId() з tracking.ts */
  machineId?: string;
  /** Розміщення: 'game_page' (за замовчуванням) або 'global' */
  placement?: BannerPlacement;
}): Promise<BannerData[]> {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getSupabaseCredentials();

    const searchParams = new URLSearchParams({
      game_slug: params.gameSlug,
      game_id: params.gameId,
    });

    if (params.machineId) {
      searchParams.set('machine_id', params.machineId);
    }
    if (params.placement) {
      searchParams.set('placement', params.placement);
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
        `[banners-api] Fetched ${response.body.banners.length} banners for game=${params.gameSlug}`
      );
      return response.body.banners;
    }

    console.warn('[banners-api] Failed to fetch banners:', response.body.error);
    return [];
  } catch (error) {
    console.error('[banners-api] Error fetching banners:', error);
    return [];
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
 * const iconUrl = buildBannerImageUrl(SUPABASE_URL, banner.icon_path);
 * // https://xxx.supabase.co/storage/v1/object/public/banner-images/icons/kuli.webp
 * ```
 */
export function buildBannerImageUrl(
  supabaseUrl: string,
  path: string | null | undefined
): string | null {
  if (!path) return null;
  return `${supabaseUrl}/storage/v1/object/public/banner-images/${path}`;
}
