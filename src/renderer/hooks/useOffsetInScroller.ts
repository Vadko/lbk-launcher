import { type RefObject, useLayoutEffect, useState } from 'react';

// The distance from the top of the scroller's content to the element, kept current as the layout above it reflows
export function useOffsetInScroller(
  scrollerRef: RefObject<HTMLElement | null>,
  elementRef: RefObject<HTMLElement | null>
): number {
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const element = elementRef.current;
    if (!scroller || !element) {
      return;
    }
    const measure = () =>
      setOffset(
        element.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef, elementRef]);

  return offset;
}
