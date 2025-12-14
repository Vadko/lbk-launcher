import { useEffect, useRef } from 'react';

const preloadedUrls = new Set<string>();

/**
 * Preloads images when element becomes visible in viewport
 */
export function useImagePreload(
  urls: (string | null)[],
  options?: { rootMargin?: string }
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasPreloaded = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasPreloaded.current) return;

    const validUrls = urls.filter(
      (url): url is string => url !== null && !preloadedUrls.has(url)
    );

    if (validUrls.length === 0) {
      hasPreloaded.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasPreloaded.current) {
          hasPreloaded.current = true;

          validUrls.forEach((url) => {
            if (!preloadedUrls.has(url)) {
              const img = new Image();
              img.src = url;
              preloadedUrls.add(url);
            }
          });

          observer.disconnect();
        }
      },
      { rootMargin: options?.rootMargin ?? '200px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [urls, options?.rootMargin]);

  return elementRef;
}
