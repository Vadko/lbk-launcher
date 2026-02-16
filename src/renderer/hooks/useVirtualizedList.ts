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
  const [renderCount, setRenderCount] = useState(initialRenderCount);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Clamp renderCount to actual totalItems (handles filter changes automatically)
  const actualRenderCount = enabled ? Math.min(renderCount, totalItems) : totalItems;

  // Setup IntersectionObserver
  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Don't observe if we're already rendering everything
    if (actualRenderCount >= totalItems) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRenderCount((prev) => Math.min(prev + incrementCount, totalItems));
        }
      },
      { rootMargin }
    );

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, actualRenderCount, totalItems, incrementCount, rootMargin]);

  const reset = useCallback(() => {
    setRenderCount(initialRenderCount);
  }, [initialRenderCount]);

  return {
    renderCount: actualRenderCount,
    sentinelRef,
    reset,
  };
}
