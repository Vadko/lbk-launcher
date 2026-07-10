import { useEffect, useRef } from 'react';

const preloadedUrls = new Set<string>();

export function useImagePreload(urls: (string | null)[]) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasPreloaded = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasPreloaded.current) return;

    const preload = () => {
      if (hasPreloaded.current) return;
      hasPreloaded.current = true;

      for (const url of urls) {
        if (url && !preloadedUrls.has(url)) {
          const img = new Image();
          img.src = url;
          preloadedUrls.add(img.src);
          preloadedUrls.add(url);
        }
      }
    };

    element.addEventListener('mouseenter', preload, { once: true });
    element.addEventListener('focusin', preload, { once: true });

    return () => {
      element.removeEventListener('mouseenter', preload);
      element.removeEventListener('focusin', preload);
    };
  }, [urls]);

  return elementRef;
}
