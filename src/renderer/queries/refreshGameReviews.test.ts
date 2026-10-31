import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewPages } from '../utils/reviewCache';
import { reviewPages, reviewThread } from '../utils/reviewPages.fixture';
import { refreshGameReviews } from './refreshGameReviews';
import { REVIEWS_KEY } from './reviewActions.fixture';

function watched(queryFn: () => Promise<ReviewPages>) {
  const queryClient = new QueryClient();
  const observer = new QueryObserver(queryClient, { queryKey: REVIEWS_KEY, queryFn });
  const unsubscribe = observer.subscribe(() => undefined);
  return { queryClient, unsubscribe };
}

describe('refreshGameReviews', () => {
  it('restarts a first load rather than let it land with what it read before', async () => {
    const before = reviewPages([reviewThread('old')]);
    const after = reviewPages([reviewThread('new')]);
    const loads: Array<(pages: ReviewPages) => void> = [];
    const queryFn = vi.fn(
      () => new Promise<ReviewPages>((resolve) => loads.push(resolve))
    );
    const { queryClient, unsubscribe } = watched(queryFn);
    await vi.waitFor(() => expect(loads).toHaveLength(1));

    refreshGameReviews(queryClient, 'g1');
    await vi.waitFor(() => expect(loads).toHaveLength(2));
    loads[0]?.(before);
    loads[1]?.(after);

    await vi.waitFor(() => expect(queryClient.getQueryData(REVIEWS_KEY)).toBe(after));
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('refetches loaded pages with a plain invalidate', async () => {
    const pages = reviewPages([reviewThread('t')]);
    const { queryClient, unsubscribe } = watched(() => Promise.resolve(pages));
    await vi.waitFor(() => expect(queryClient.getQueryData(REVIEWS_KEY)).toBe(pages));
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    refreshGameReviews(queryClient, 'g1');

    expect(cancel).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: REVIEWS_KEY });
    unsubscribe();
  });
});
