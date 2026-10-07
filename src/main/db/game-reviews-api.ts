import type { GameReviewsPage } from '../../shared/types';
import { getSupabaseClient } from './supabase-client';

interface GetGameReviewsResponse extends Partial<GameReviewsPage> {
  success: boolean;
  error?: string;
}

export async function fetchGameReviews(
  gameId: string,
  page: number,
  pageSize: number
): Promise<GameReviewsPage | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke<GetGameReviewsResponse>(
      'get-game-reviews',
      { body: { gameId, page, pageSize } }
    );

    if (error || !data?.success || !data.items) {
      console.warn('[game-reviews-api] Failed to fetch reviews:', error ?? data?.error);
      return null;
    }

    return {
      items: data.items,
      total: data.total ?? data.items.length,
      pageSize: data.pageSize ?? pageSize,
    };
  } catch (error) {
    console.error('[game-reviews-api] Error fetching reviews:', error);
    return null;
  }
}
