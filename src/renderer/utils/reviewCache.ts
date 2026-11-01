import type { InfiniteData } from '@tanstack/react-query';
import type { GameReviewsPage } from '@/shared/game-reviews-types';

export interface ReviewCachePage extends GameReviewsPage {
  // The deep link whose focus thread this first page was fetched with
  focusKey?: string;
}

export type ReviewPages = InfiniteData<ReviewCachePage>;
