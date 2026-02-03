import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVirtualizedListOptions {
  /** Total number of items */
  totalItems: number;
  /** How many items to render initially */
  initialRenderCount?: number;
  /** How many items to add when scrolling near the end */
  incrementCount?: number;
  /** Root margin for intersection observer (how early to trigger) */
  rootMargin?: string;
  /** Whether virtualization is enabled */
  enabled?: boolean;
}

interface UseVirtualizedListResult {
  /** Number of items to render */
  renderCount: number;
  /** Ref to attach to the sentinel element at the end of the list */
  sentinelRef: React.RefObject<HTMLDivElement>;
  /** Reset the render count (e.g., when filters change) */
  reset: () => void;
}

/**
 * Hook for progressive rendering of long lists using IntersectionObserver.
 * Instead of rendering all items at once, it starts with a small batch
 * and adds more as the user scrolls down.
 */
export function useVirtualizedList({
  totalItems,
  initialRenderCount = 20,
  incrementCount = 20,
  rootMargin = '200px',
  enabled = true,
}: UseVirtualizedListOptions): UseVirtualizedListResult {
  const [renderCount, setRenderCount] = useState(
    enabled ? Math.min(initialRenderCount, totalItems) : totalItems
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset when totalItems changes (e.g., filter applied)
  useEffect(() => {
    if (enabled) {
      setRenderCount(Math.min(initialRenderCount, totalItems));
    } else {
      setRenderCount(totalItems);
    }
  }, [totalItems, initialRenderCount, enabled]);

  // Setup IntersectionObserver
  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Don't observe if we're already rendering everything
    if (renderCount >= totalItems) {
      console.log('[VirtualizedList] All items rendered:', renderCount, '/', totalItems);
      return;
    }

    console.log(
      '[VirtualizedList] Observing sentinel, current:',
      renderCount,
      '/',
      totalItems
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRenderCount((prev) => {
            const next = Math.min(prev + incrementCount, totalItems);
            console.log(
              '[VirtualizedList] Loading more:',
              prev,
              '->',
              next,
              '/',
              totalItems
            );
            return next;
          });
        }
      },
      { rootMargin }
    );

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, renderCount, totalItems, incrementCount, rootMargin]);

  const reset = useCallback(() => {
    if (enabled) {
      setRenderCount(Math.min(initialRenderCount, totalItems));
    } else {
      setRenderCount(totalItems);
    }
  }, [enabled, initialRenderCount, totalItems]);

  return {
    renderCount,
    sentinelRef,
    reset,
  };
}
