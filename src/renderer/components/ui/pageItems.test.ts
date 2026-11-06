import { describe, expect, it } from 'vitest';
import { pageItems } from './pageItems';

describe('pageItems', () => {
  it('lists every page when they fit', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the start run near the first page', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'gap-end', 10]);
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap-end', 10]);
  });

  it('centres the current page in the middle', () => {
    expect(pageItems(5, 10)).toEqual([1, 'gap-start', 4, 5, 6, 'gap-end', 10]);
    expect(pageItems(6, 10)).toEqual([1, 'gap-start', 5, 6, 7, 'gap-end', 10]);
  });

  it('keeps the end run near the last page', () => {
    expect(pageItems(7, 10)).toEqual([1, 'gap-start', 6, 7, 8, 9, 10]);
    expect(pageItems(10, 10)).toEqual([1, 'gap-start', 6, 7, 8, 9, 10]);
  });

  it('always shows seven slots once the pages do not fit', () => {
    const lengths = Array.from({ length: 30 }, (_, i) => pageItems(i + 1, 30).length);
    expect(new Set(lengths)).toEqual(new Set([7]));
  });
});
