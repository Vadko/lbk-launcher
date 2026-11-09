import { useEffect, useRef } from 'react';

interface Options {
  hasNextPage: boolean;
  // Holds the sentinel, which looks again once this turns false
  isBusy: boolean;
  fetchNextPage: () => void;
}

export function useInfiniteScrollSentinel({
  hasNextPage,
  isBusy,
  fetchNextPage,
}: Options) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const attachSentinel = (node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) {
      return;
    }
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isBusy) {
        fetchNextPage();
      }
    });
    observerRef.current.observe(node);
  };

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return attachSentinel;
}
