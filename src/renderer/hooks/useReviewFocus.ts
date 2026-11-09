import { useEffect, useState } from 'react';
import type { ReviewThreadView } from '../queries/reviewViewTypes';
import type { ReviewFocus } from '../utils/readReviewLink';
import { reviewFocusTarget } from '../utils/reviewFocusTarget';

interface ReviewFocusOptions {
  focus: ReviewFocus | null;
  threads: readonly ReviewThreadView[];
  // The link's own list is loaded and nothing refetches it, so it holds what the link points at
  isSettled: boolean;
  // A missing entry may then be one the list failed to bring
  isRefetchError: boolean;
  onHandled: () => void;
}

// Keys of gameReviews
type FocusNotice = 'focusMissing' | 'focusFailed';

export function useReviewFocus({
  focus,
  threads,
  isSettled,
  isRefetchError,
  onHandled,
}: ReviewFocusOptions) {
  const target = focus !== null && isSettled ? reviewFocusTarget(threads, focus) : null;
  const missing: FocusNotice = isRefetchError ? 'focusFailed' : 'focusMissing';
  // The last handled link's notice, so it stays after the URL lets go of the link
  const [outcome, setOutcome] = useState<{
    focus: ReviewFocus;
    notice: FocusNotice | null;
  } | null>(null);
  const isEnded = focus !== null && isSettled && target === null;
  if (isEnded && outcome?.focus.key !== focus.key) {
    setOutcome({ focus, notice: missing });
  }
  const isOutcomeCurrent = focus === null || outcome?.focus.key === focus.key;
  useEffect(() => {
    if (isEnded) {
      onHandled();
    }
  }, [isEnded, onHandled]);

  const isEntryShown = target?.isEntryShown ?? false;
  const onFocused = () => {
    if (focus !== null) {
      setOutcome({ focus, notice: isEntryShown ? null : missing });
    }
    onHandled();
  };

  return {
    threadId: target?.threadId ?? null,
    entryId: target?.entryId ?? null,
    onFocused,
    notice: isOutcomeCurrent ? (outcome?.notice ?? null) : null,
  };
}
