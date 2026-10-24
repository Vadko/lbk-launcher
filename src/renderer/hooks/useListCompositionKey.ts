import { useEffect, useMemo } from 'react';

/**
 * List composition key: changes whenever the result set does (search/filters/sorting).
 * Used as a key prefix to restart framer-motion entrance animations
 * and to reset the container scroll to the top on a new result set.
 */
export function useListCompositionKey(
  items: ReadonlyArray<{ key: string }>,
  scrollRef: React.RefObject<HTMLElement | null>,
  axis: 'vertical' | 'horizontal'
): string {
  const compositionKey = useMemo(() => {
    const first = items[0]?.key ?? '';
    const last = items[items.length - 1]?.key ?? '';
    return `${items.length}_${first}_${last}`;
  }, [items]);

  useEffect(() => {
    scrollRef.current?.scrollTo(axis === 'vertical' ? { top: 0 } : { left: 0 });
  }, [compositionKey, scrollRef, axis]);

  return compositionKey;
}
