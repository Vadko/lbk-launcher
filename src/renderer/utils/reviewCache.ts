import type { InfiniteData } from '@tanstack/react-query';
import type { GameReviewsPage } from '@/shared/game-reviews-types';

export interface ReviewPage extends GameReviewsPage {
  // When the page was asked for, so a write answered later is never taken as in it
  fetchedAt: number;
}

export type ReviewPages = InfiniteData<ReviewPage>;
