import { REVIEWS_TAB } from '@/shared/game-link-target';

export interface ReviewLinkFocus {
  feedbackId: string;
  entryId: string;
}

// One deep link's focus; the key tells two clicks on the same link apart
export interface ReviewFocus extends ReviewLinkFocus {
  key: string;
}

interface ReviewLink {
  focus: ReviewLinkFocus | null;
}

// Ids pass unchecked: links come only from gameLink() with server ids, and reviewFocusTarget falls back from a bad entry to its thread
export function readReviewLink(search: string): ReviewLink | null {
  const params = new URLSearchParams(search);
  if (params.get('tab') !== REVIEWS_TAB) {
    return null;
  }
  const feedbackId = params.get('thread');
  const entryId = params.get('entry');
  return { focus: feedbackId && entryId ? { feedbackId, entryId } : null };
}
