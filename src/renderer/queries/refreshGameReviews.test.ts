import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewPages } from '../utils/reviewCache';
import { reviewPages, reviewThread } from '../utils/reviewPages.fixture';
import { refreshGameReviews } from './refreshGameReviews';
import { REVIEWS_KEY } from './reviewActions.fixture';

// A deep link's list is a query of its own under the game's key
const LINKED_KEY = [...REVIEWS_KEY, 't'];

function watched(queryFn: () => Promise<ReviewPages>) {
  const queryClient = new QueryClient();
  const observer = new QueryObserver(queryClient, { queryKey: LINKED_KEY, queryFn });
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

    await vi.waitFor(() => expect(queryClient.getQueryData(LINKED_KEY)).toBe(after));
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('keeps loaded pages on screen while it refetches them', async () => {
    const pages = reviewPages([reviewThread('t')]);
    const fresh = reviewPages([reviewThread('t'), reviewThread('u')]);
    const queryFn = vi
      .fn<() => Promise<ReviewPages>>()
      .mockResolvedValueOnce(pages)
      .mockResolvedValueOnce(fresh);
    const { queryClient, unsubscribe } = watched(queryFn);
    await vi.waitFor(() => expect(queryClient.getQueryData(LINKED_KEY)).toBe(pages));

    refreshGameReviews(queryClient, 'g1');

    expect(queryClient.getQueryData(LINKED_KEY)).toBe(pages);
    await vi.waitFor(() => expect(queryClient.getQueryData(LINKED_KEY)).toEqual(fresh));
    unsubscribe();
  });
});
