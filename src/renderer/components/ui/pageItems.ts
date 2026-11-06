export type PageItem = number | 'gap-start' | 'gap-end';

const MAX_ITEMS = 7;
const EDGE_RUN = 5;

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Always seven slots once the pages do not fit, so the arrows never shift under the pointer or the gamepad
export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= MAX_ITEMS) {
    return range(1, pageCount);
  }
  if (page < EDGE_RUN) {
    return [...range(1, EDGE_RUN), 'gap-end', pageCount];
  }
  if (page > pageCount - EDGE_RUN + 1) {
    return [1, 'gap-start', ...range(pageCount - EDGE_RUN + 1, pageCount)];
  }
  return [1, 'gap-start', page - 1, page, page + 1, 'gap-end', pageCount];
}
