import { useEffect, useState } from 'react';
import { REVIEW_REVEAL_MS } from '../components/MainContent/reviewRevealMs';
import { useSettingsStore } from '../store/useSettingsStore';
import { branchesToReveal } from '../utils/branchesToReveal';
import type { ReplyNode } from '../utils/replyTree';
import { revealEntry } from '../utils/revealEntry';

interface FocusEntryOptions {
  rootId: string;
  tree: ReplyNode[];
  entryId: string | null;
  expanded: ReadonlySet<string>;
  expand: (branchIds: string[]) => void;
  onFocused: () => void;
}

// Opens the branches above a deep-linked entry, then scrolls to it and highlights it
export function useFocusEntry({
  rootId,
  tree,
  entryId,
  expanded,
  expand,
  onFocused,
}: FocusEntryOptions): void {
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const [focused, setFocused] = useState<{ entryId: string | null; delay: number }>({
    entryId: null,
    delay: 0,
  });
  if (focused.entryId !== entryId) {
    const opening =
      entryId === null || entryId === rootId
        ? []
        : (branchesToReveal(tree, entryId) ?? []).filter((id) => !expanded.has(id));
    if (opening.length > 0) {
      expand(opening);
    }
    // Opened rows grow for the reveal's length and would push the entry past a scroll aimed sooner
    setFocused({
      entryId,
      delay: opening.length > 0 && animationsEnabled ? REVIEW_REVEAL_MS : 0,
    });
  }

  useEffect(() => {
    const target = focused.entryId;
    if (target === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      revealEntry(target, animationsEnabled);
      onFocused();
    }, focused.delay);
    return () => window.clearTimeout(timer);
  }, [focused, animationsEnabled, onFocused]);
}
