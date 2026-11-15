import { useEffect, useState } from 'react';
import { useReviewDraftsStore } from '../store/useReviewDraftsStore';

// True only for the mount right after the player opened this draft, not when a kept draft shows again
export function useDraftFocusRequest(draftKey: string): boolean {
  const requested = useReviewDraftsStore((state) => state.focusRequest === draftKey);
  const [focus] = useState(requested);
  useEffect(() => {
    useReviewDraftsStore.getState().takeFocusRequest(draftKey);
  }, [draftKey]);
  return focus;
}
