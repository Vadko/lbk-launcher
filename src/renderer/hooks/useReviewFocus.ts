import { useCallback, useEffect, useState } from 'react';
import type { ReviewThreadView } from '../queries/reviewViewTypes';
import type { ReviewFocus } from '../utils/readReviewLink';
import type { ReviewCachePage } from '../utils/reviewCache';
import { reviewFocusTarget } from '../utils/reviewFocusTarget';

interface ReviewFocusOptions {
  focus: ReviewFocus | null;
  // The link whose own refresh failed, which ends it without a scroll
  failedKey: string | null;
  firstPage: ReviewCachePage | undefined;
  threads: readonly ReviewThreadView[];
  isFetching: boolean;
  onHandled: () => void;
}

// Keys of gameReviews
type FocusNotice = 'focusMissing' | 'focusFailed';

// Waits for a first page fetched for this very link, since cached pages may predate the linked entry
export function useReviewFocus({
  focus,
  failedKey,
  firstPage,
  threads,
  isFetching,
  onHandled,
}: ReviewFocusOptions) {
  const isFailed = focus !== null && focus.key === failedKey;
  const isLoaded =
    focus !== null && !isFailed && !isFetching && firstPage?.focusKey === focus.key;
  const target = isLoaded ? reviewFocusTarget(threads, focus) : null;
  // The last handled link's notice, so it stays after the URL lets go of the link
  const [outcome, setOutcome] = useState<{
    focus: ReviewFocus;
    notice: FocusNotice | null;
  } | null>(null);
  const isEnded = isFailed || (isLoaded && target === null);
  if (focus !== null && isEnded && outcome?.focus.key !== focus.key) {
    setOutcome({ focus, notice: isFailed ? 'focusFailed' : 'focusMissing' });
  } else if (
    outcome?.notice === 'focusFailed' &&
    firstPage?.focusKey === outcome.focus.key
  ) {
    // A later refetch still asks for the failed link's thread, so its page tells whether the entry is shown
    const isShown = reviewFocusTarget(threads, outcome.focus)?.isEntryShown ?? false;
    setOutcome({ focus: outcome.focus, notice: isShown ? null : 'focusMissing' });
  }
  const isOutcomeCurrent = focus === null || outcome?.focus.key === focus.key;
  useEffect(() => {
    if (isEnded) {
      onHandled();
    }
  }, [isEnded, onHandled]);

  const isEntryShown = target?.isEntryShown ?? false;
  const onFocused = useCallback(() => {
    if (focus !== null) {
      setOutcome({ focus, notice: isEntryShown ? null : 'focusMissing' });
    }
    onHandled();
  }, [focus, isEntryShown, onHandled]);

  return {
    threadId: target?.threadId ?? null,
    entryId: target?.entryId ?? null,
    onFocused,
    notice: isOutcomeCurrent ? (outcome?.notice ?? null) : null,
  };
}
