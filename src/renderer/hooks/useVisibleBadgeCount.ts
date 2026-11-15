import { useLayoutEffect, useState } from 'react';

// The measure layer holds every badge at its natural width, then the "+N" badge last
function fitBadges(row: HTMLElement, measure: HTMLElement) {
  const widths = [...measure.children].map(
    (child) => child.getBoundingClientRect().width
  );
  const moreWidth = widths.pop() ?? 0;
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
  const available = row.getBoundingClientRect().width;

  let used = 0;
  let visible = 0;
  for (const [index, width] of widths.entries()) {
    const next = used + (index > 0 ? gap : 0) + width;
    const reserve = index < widths.length - 1 ? gap + moreWidth : 0;
    if (next + reserve > available) {
      break;
    }
    used = next;
    visible = index + 1;
  }
  return Math.max(1, visible);
}

export function useVisibleBadgeCount(
  rowRef: React.RefObject<HTMLElement | null>,
  measureRef: React.RefObject<HTMLElement | null>,
  total: number
) {
  const [visible, setVisible] = useState(total);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) {
      return;
    }
    const observer = new ResizeObserver(() => setVisible(fitBadges(row, measure)));
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [rowRef, measureRef, total]);

  return Math.min(visible, total);
}
