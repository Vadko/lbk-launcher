import type { GameReview, GameReviewsPage } from '../../shared/game-reviews-types';

interface FocusedPage extends GameReviewsPage {
  // The deep-linked thread, which may sit on a page not loaded yet
  focus: GameReview | null;
}

// Every cache helper reads only items, so the focus thread joins them instead of riding beside
export function withFocus({ focus, ...page }: FocusedPage): GameReviewsPage {
  if (!focus || page.items.some((thread) => thread.id === focus.id)) {
    return page;
  }
  return { ...page, items: [focus, ...page.items] };
}
