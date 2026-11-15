import { A, pipe } from '@mobily/ts-belt';
import { useLayoutEffect, useState } from 'react';

// The measure layer holds every badge at its natural width, then the "+N" badge last
function fitBadges(row: HTMLElement, measure: HTMLElement) {
  const widths = [...measure.children].map(
    (child) => child.getBoundingClientRect().width
  );
  const moreWidth = widths.pop() ?? 0;
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
  const available = row.getBoundingClientRect().width;

  return pipe(
    widths,
    A.reduce<number, number[]>([], (rows, width) => [
      ...rows,
      (rows.at(-1) ?? -gap) + gap + width,
    ]),
    A.mapWithIndex(
      (index, row) => row + (index < widths.length - 1 ? gap + moreWidth : 0)
    ),
    A.takeWhile((needed) => needed <= available),
    A.length,
    (count) => Math.max(1, count)
  );
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
