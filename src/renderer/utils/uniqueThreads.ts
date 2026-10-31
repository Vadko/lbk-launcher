import { A } from '@mobily/ts-belt';

// The focus thread rides on the first page and comes again once its own page loads
export function uniqueThreads<T extends { id: string }>(
  pages: ReadonlyArray<{ items: T[] }>
): readonly T[] {
  return A.uniqBy(
    pages.flatMap((page) => page.items),
    (thread) => thread.id
  );
}
